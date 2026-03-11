import 'package:flutter/material.dart';

import '../apis/room_cleaning/room_cleaning_api.dart';

class RoomCleaningActionResult {
  final bool success;
  final String message;

  RoomCleaningActionResult({
    required this.success,
    required this.message,
  });
}

class RoomCleaningProvider extends ChangeNotifier {
  final RoomCleaningApi _api = RoomCleaningApi();

  RoomCleaningAvailability? availability;
  bool isAvailabilityLoading = false;
  String? availabilityError;

  List<RoomCleaningBooking> myBookings = [];
  bool isBookingsLoading = false;
  String? bookingsError;

  String _normalizeBookingMessage(Object value) {
    var raw = value.toString();
    if (raw.startsWith('Exception:')) {
      raw = raw.substring('Exception:'.length).trimLeft();
    }

    if (raw.contains(
      'You can only have one room cleaning booking in any 14-day period.',
    )) {
      return 'You already have a room cleaning request in the last 14 days.';
    }

    if (raw.contains(
      'No capacity left for this slot on the selected date.',
    )) {
      return 'This slot is full. Please choose another time.';
    }

    if (raw.contains(
      'You already have a booking for this slot on this date in this hostel.',
    )) {
      return 'You have already booked this slot for this date.';
    }

    if (raw.contains('Failed to create room-cleaning booking') ||
        raw.contains('Failed to create room cleaning booking')) {
      return 'Could not create your booking. Please try again.';
    }

    return raw;
  }

  String _normalizeAvailabilityError(Object value) {
    var raw = value.toString();
    if (raw.startsWith('Exception:')) {
      raw = raw.substring('Exception:'.length).trimLeft();
    }

    // Common networking / base URL issues.
    if (raw.contains('Connection refused') ||
        raw.contains('SocketException') ||
        raw.contains('Failed host lookup') ||
        raw.contains('ClientException with SocketException')) {
      return 'Could not reach the server. Please check your internet connection and try again.';
    }

    return 'Something went wrong while loading room-cleaning availability. Please try again.\n\nDetails: $raw';
  }

  Future<void> loadAvailability() async {
    isAvailabilityLoading = true;
    availabilityError = null;
    notifyListeners();

    try {
      availability = await _api.fetchAvailability();
    } catch (e) {
      availability = null;
      availabilityError = _normalizeAvailabilityError(e);
    } finally {
      isAvailabilityLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMyBookings() async {
    isBookingsLoading = true;
    bookingsError = null;
    notifyListeners();

    try {
      myBookings = await _api.getMyBookings();
    } catch (e) {
      myBookings = [];
      bookingsError = e.toString();
    } finally {
      isBookingsLoading = false;
      notifyListeners();
    }
  }

  Future<RoomCleaningActionResult> bookSlot({
    required DateTime date,
    required String slot,
  }) async {
    try {
      final response = await _api.bookSlot(date: date, slot: slot);
      // Refresh availability and bookings after a successful booking.
      await Future.wait([
        loadAvailability(),
        loadMyBookings(),
      ]);
      final msg =
          response['message']?.toString() ?? 'Room cleaning booking created.';
      return RoomCleaningActionResult(
        success: true,
        message: _normalizeBookingMessage(msg),
      );
    } catch (e) {
      return RoomCleaningActionResult(
        success: false,
        message: _normalizeBookingMessage(e),
      );
    }
  }

  Future<RoomCleaningActionResult> cancelBooking(String bookingId) async {
    try {
      final response = await _api.cancelBooking(bookingId);
      await Future.wait([
        loadAvailability(),
        loadMyBookings(),
      ]);
      final msg = response['message']?.toString() ??
          'Room cleaning booking cancelled successfully.';
      return RoomCleaningActionResult(
        success: true,
        message: _normalizeBookingMessage(msg),
      );
    } catch (e) {
      return RoomCleaningActionResult(
        success: false,
        message: _normalizeBookingMessage(e),
      );
    }
  }

  Future<RoomCleaningActionResult> submitFeedback({
    required String bookingId,
    required String reachedInSlot,
    required String staffPoliteness,
    required int satisfaction,
    String? remarks,
  }) async {
    try {
      final response = await _api.submitFeedback(
        bookingId: bookingId,
        reachedInSlot: reachedInSlot,
        staffPoliteness: staffPoliteness,
        satisfaction: satisfaction,
        remarks: remarks,
      );
      await loadMyBookings();
      final msg = response['message']?.toString() ??
          'Thank you for sharing your feedback.';
      return RoomCleaningActionResult(
        success: true,
        message: _normalizeBookingMessage(msg),
      );
    } catch (e) {
      return RoomCleaningActionResult(
        success: false,
        message: _normalizeBookingMessage(e),
      );
    }
  }
}

