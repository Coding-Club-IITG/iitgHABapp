import 'dart:convert';

import 'package:frontend2/apis/dio_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';

import '../../constants/endpoint.dart';

class RoomCleaningSlotAvailability {
  final String slot;
  final String timeRange;
  final int primaryCapacity;
  final int extraCapacity;
  final int slotsLeft;
  final int extraSlotsLeft;

  RoomCleaningSlotAvailability({
    required this.slot,
    required this.timeRange,
    required this.primaryCapacity,
    required this.extraCapacity,
    required this.slotsLeft,
    required this.extraSlotsLeft,
  });

  factory RoomCleaningSlotAvailability.fromJson(Map<String, dynamic> json) {
    return RoomCleaningSlotAvailability(
      slot: json['slot']?.toString() ?? '',
      timeRange: json['timeRange']?.toString() ?? '',
      primaryCapacity: (json['primaryCapacity'] as num?)?.toInt() ?? 0,
      extraCapacity: (json['bufferCapacity'] as num?)?.toInt() ?? 0,
      slotsLeft: (json['slotsLeft'] as num?)?.toInt() ?? 0,
      extraSlotsLeft: (json['bufferSlotsLeft'] as num?)?.toInt() ?? 0,
    );
  }
}

class RoomCleaningDayAvailability {
  final DateTime date;
  final DateTime openTime;
  final DateTime closeTime;
  final List<RoomCleaningSlotAvailability> slots;

  RoomCleaningDayAvailability({
    required this.date,
    required this.openTime,
    required this.closeTime,
    required this.slots,
  });

  factory RoomCleaningDayAvailability.fromJson(Map<String, dynamic> json) {
    final slotsJson = (json['slots'] as List<dynamic>? ?? []);
    // `date` from backend is a calendar date in IST; treat it as date-only.
    final rawDate = json['date'] as String;
    final dateOnly = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    final parsedParts = dateOnly.split('-');
    final year = int.parse(parsedParts[0]);
    final month = int.parse(parsedParts[1]);
    final day = int.parse(parsedParts[2]);

    return RoomCleaningDayAvailability(
      date: DateTime(year, month, day),
      openTime: DateTime.parse(json['openTime'] as String),
      closeTime: DateTime.parse(json['closeTime'] as String),
      slots: slotsJson
          .map((e) => RoomCleaningSlotAvailability.fromJson(
                e as Map<String, dynamic>,
              ))
          .toList(),
    );
  }
}

class RoomCleaningAvailability {
  final bool canBook;
  final String hostelId;
  final String? hostelName;
  final DateTime now;
  final List<RoomCleaningDayAvailability> days;

  RoomCleaningAvailability({
    required this.canBook,
    required this.hostelId,
    required this.hostelName,
    required this.now,
    required this.days,
  });

  factory RoomCleaningAvailability.fromJson(Map<String, dynamic> json) {
    final daysJson = (json['days'] as List<dynamic>? ?? []);
    return RoomCleaningAvailability(
      canBook: json['canBook'] == true,
      hostelId: json['hostelId']?.toString() ?? '',
      hostelName: json['hostelName']?.toString(),
      now: DateTime.parse(json['now'] as String),
      days: daysJson
          .map((e) => RoomCleaningDayAvailability.fromJson(
                e as Map<String, dynamic>,
              ))
          .toList(),
    );
  }
}

class RoomCleaningBooking {
  final String id;
  final DateTime bookingDate;
  final String slot;
  final String status;
  final String? feedbackId;
  final String? reason;

  /// True when cancel is allowed (Booked/Waitlisted, future date, window open).
  final bool canCancel;

  RoomCleaningBooking({
    required this.id,
    required this.bookingDate,
    required this.slot,
    required this.status,
    required this.feedbackId,
    required this.reason,
    required this.canCancel,
  });

  factory RoomCleaningBooking.fromJson(Map<String, dynamic> json) {
    // Backend stores bookingDate as IST start-of-day in UTC (e.g. 2026-03-12T18:30:00Z == 13 Mar IST).
    // Convert to an IST calendar date so the UI doesn't shift based on device timezone.
    final rawBookingDate = json['bookingDate'] as String;
    final parsed = DateTime.parse(rawBookingDate);
    final ist = parsed.toUtc().add(const Duration(hours: 5, minutes: 30));
    final istDateOnly = DateTime(ist.year, ist.month, ist.day);
    return RoomCleaningBooking(
      id: json['_id']?.toString() ?? '',
      bookingDate: istDateOnly,
      slot: json['slot']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      feedbackId: json['feedbackId']?.toString(),
      reason: json['reason']?.toString(),
      canCancel: json['canCancel'] == true,
    );
  }
}

class RoomCleaningApi {
  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  Future<RoomCleaningAvailability> fetchAvailability() async {
    final dio = DioClient().dio;
    final response = await dio.get('$baseUrl/room-cleaning/availability');
    if (response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      final data = response.data as Map<String, dynamic>;
      return RoomCleaningAvailability.fromJson(data);
    } else {
      throw Exception(
          'Failed to fetch room cleaning availability (${response.statusCode})');
    }
  }

  Future<Map<String, dynamic>> bookSlot({
    required DateTime date,
    required String slot,
    required String roomNumber,
    required String phoneNumber,
  }) async {
    final dio = DioClient().dio;
    final bookingPayload = {
      'date': date.toIso8601String().split('T').first,
      'slot': slot,
      'roomNumber': roomNumber,
      'phoneNumber': phoneNumber,
    };
    debugPrint('[RoomCleaningApi] Booking request: $bookingPayload');
    try {
      final response = await dio.post(
        '$baseUrl/room-cleaning/booking',
        data: bookingPayload,
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      final body = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : <String, dynamic>{};
      debugPrint(
          '[RoomCleaningApi] Booking response: ${response.statusCode} $body');
      if (response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300) {
        return body;
      } else {
        final msg = body['message']?.toString() ??
            'Failed to create room cleaning booking';
        debugPrint('[RoomCleaningApi] Booking error: $msg');
        throw Exception(msg);
      }
    } catch (e, stack) {
      debugPrint('[RoomCleaningApi] Booking exception: $e');
      debugPrint('[RoomCleaningApi] Stack: $stack');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    final dio = DioClient().dio;
    final response = await dio.post(
      '$baseUrl/room-cleaning/booking/cancel',
      data: {'bookingId': bookingId},
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
    final body = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : <String, dynamic>{};
    if (response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      return body;
    } else {
      final msg = body['message']?.toString() ??
          'Failed to cancel room cleaning booking';
      throw Exception(msg);
    }
  }

  Future<List<RoomCleaningBooking>> getMyBookings() async {
    final dio = DioClient().dio;
    final response = await dio.get('$baseUrl/room-cleaning/booking/my');
    if (response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      final data = response.data as Map<String, dynamic>;
      final list = (data['bookings'] as List<dynamic>? ?? []);
      return list
          .map((e) => RoomCleaningBooking.fromJson(
                e as Map<String, dynamic>,
              ))
          .toList();
    } else {
      throw Exception(
          'Failed to fetch room cleaning bookings (${response.statusCode})');
    }
  }

  Future<Map<String, dynamic>> submitFeedback({
    required String bookingId,
    required String reachedInSlot,
    required String staffPoliteness,
    required int satisfaction,
    String? remarks,
  }) async {
    final dio = DioClient().dio;
    final response = await dio.post(
      '$baseUrl/room-cleaning/booking/feedback',
      data: {
        'bookingId': bookingId,
        'reachedInSlot': reachedInSlot,
        'staffPoliteness': staffPoliteness,
        'satisfaction': satisfaction,
        if (remarks != null && remarks.trim().isNotEmpty)
          'remarks': remarks.trim(),
      },
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
    final body = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : <String, dynamic>{};
    if (response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      return body;
    } else {
      final msg = body['message']?.toString() ?? 'Failed to submit feedback';
      throw Exception(msg);
    }
  }
}
