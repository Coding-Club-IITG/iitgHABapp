import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../constants/endpoint.dart';

class RoomCleaningSlotAvailability {
  final String slot;
  final String timeRange;
  final int primaryCapacity;
  final int bufferCapacity;
  final int slotsLeft;
  final int bufferSlotsLeft;

  RoomCleaningSlotAvailability({
    required this.slot,
    required this.timeRange,
    required this.primaryCapacity,
    required this.bufferCapacity,
    required this.slotsLeft,
    required this.bufferSlotsLeft,
  });

  factory RoomCleaningSlotAvailability.fromJson(Map<String, dynamic> json) {
    return RoomCleaningSlotAvailability(
      slot: json['slot']?.toString() ?? '',
      timeRange: json['timeRange']?.toString() ?? '',
      primaryCapacity: (json['primaryCapacity'] as num?)?.toInt() ?? 0,
      bufferCapacity: (json['bufferCapacity'] as num?)?.toInt() ?? 0,
      slotsLeft: (json['slotsLeft'] as num?)?.toInt() ?? 0,
      bufferSlotsLeft: (json['bufferSlotsLeft'] as num?)?.toInt() ?? 0,
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
  /// True when cancel is allowed (Booked/Buffered, future date, window open).
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
    final token = await _getToken();

    final response = await http.get(
      Uri.parse('$baseUrl/room-cleaning/availability'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = json.decode(response.body) as Map<String, dynamic>;
      return RoomCleaningAvailability.fromJson(data);
    } else {
      throw Exception(
        'Failed to fetch room cleaning availability (${response.statusCode})',
      );
    }
  }

  Future<Map<String, dynamic>> bookSlot({
    required DateTime date,
    required String slot,
  }) async {
    final token = await _getToken();

    final response = await http.post(
      Uri.parse('$baseUrl/room-cleaning/booking'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'date': date.toIso8601String().split('T').first,
        'slot': slot,
      }),
    );

    final body = response.body.isNotEmpty
        ? json.decode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    } else {
      final msg = body['message']?.toString() ??
          'Failed to create room cleaning booking';
      throw Exception(msg);
    }
  }

  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    final token = await _getToken();

    final response = await http.post(
      Uri.parse('$baseUrl/room-cleaning/booking/cancel'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({'bookingId': bookingId}),
    );

    final body = response.body.isNotEmpty
        ? json.decode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    } else {
      final msg = body['message']?.toString() ??
          'Failed to cancel room cleaning booking';
      throw Exception(msg);
    }
  }

  Future<List<RoomCleaningBooking>> getMyBookings() async {
    final token = await _getToken();

    final response = await http.get(
      Uri.parse('$baseUrl/room-cleaning/booking/my'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = json.decode(response.body) as Map<String, dynamic>;
      final list = (data['bookings'] as List<dynamic>? ?? []);
      return list
          .map((e) => RoomCleaningBooking.fromJson(
                e as Map<String, dynamic>,
              ))
          .toList();
    } else {
      throw Exception(
        'Failed to fetch room cleaning bookings (${response.statusCode})',
      );
    }
  }

  Future<Map<String, dynamic>> submitFeedback({
    required String bookingId,
    required String reachedInSlot,
    required String staffPoliteness,
    required int satisfaction,
    String? remarks,
  }) async {
    final token = await _getToken();

    final response = await http.post(
      Uri.parse('$baseUrl/room-cleaning/booking/feedback'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'bookingId': bookingId,
        'reachedInSlot': reachedInSlot,
        'staffPoliteness': staffPoliteness,
        'satisfaction': satisfaction,
        if (remarks != null && remarks.trim().isNotEmpty)
          'remarks': remarks.trim(),
      }),
    );

    final body = response.body.isNotEmpty
        ? json.decode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    } else {
      final msg = body['message']?.toString() ??
          'Failed to submit room cleaning feedback';
      throw Exception(msg);
    }
  }
}

