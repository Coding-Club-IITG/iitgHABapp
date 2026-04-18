import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/mess/mess_menu.dart';
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/utilities/startupitem.dart';

class AppBootstrapCache {
  static Map<String, dynamic>? _data;
  static DateTime? _fetchedAt;

  static void set(Map<String, dynamic> data) {
    _data = data;
    _fetchedAt = DateTime.now();
  }

  static Map<String, dynamic>? getFresh({
    Duration maxAge = const Duration(seconds: 60),
  }) {
    if (_data == null || _fetchedAt == null) return null;
    final age = DateTime.now().difference(_fetchedAt!);
    if (age > maxAge) return null;
    return _data;
  }

  static void clear() {
    _data = null;
    _fetchedAt = null;
  }
}

String _localWeekdayName() {
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  return days[DateTime.now().weekday - 1];
}

Future<Map<String, dynamic>?> fetchAppBootstrapData({
  bool preferFreshCache = true,
}) async {
  if (preferFreshCache) {
    final cached = AppBootstrapCache.getFresh();
    if (cached != null) {
      return cached;
    }
  }

  try {
    final dio = DioClient().dio;
    final response = await dio.get(AppBootstrapEndpoints.bootstrap);

    if (response.statusCode == 200) {
      Map<String, dynamic>? root;

      if (response.data is Map<String, dynamic>) {
        root = response.data as Map<String, dynamic>;
      } else if (response.data is Map) {
        root = Map<String, dynamic>.from(response.data as Map);
      } else if (response.data is String) {
        final decoded = jsonDecode(response.data as String);
        if (decoded is Map) {
          root = Map<String, dynamic>.from(decoded);
        }
      }

      if (root != null) {
        final wrappedPayload = root['data'];
        if (wrappedPayload is Map) {
          final payload = Map<String, dynamic>.from(wrappedPayload);
          AppBootstrapCache.set(payload);
          return payload;
        }

        // Backward compatible: accept direct payload shape if server omits wrapper.
        if (root.containsKey('user') ||
            root.containsKey('upcomingGala') ||
            root.containsKey('todayMenu')) {
          AppBootstrapCache.set(root);
          return root;
        }
      }

      if (kDebugMode) {
        debugPrint(
          'App bootstrap response had unexpected shape: '
          'status=${response.statusCode}, dataType=${response.data.runtimeType}',
        );
      }
    }
  } catch (e) {
    if (kDebugMode) {
      if (e is DioException) {
        debugPrint(
          'App bootstrap fetch failed: '
          'status=${e.response?.statusCode}, '
          'path=${e.requestOptions.path}, '
          'response=${e.response?.data}',
        );
      } else {
        debugPrint('App bootstrap fetch failed: $e');
      }
    }
  }

  return null;
}

Future<bool> applyAppBootstrapData(
  Map<String, dynamic> payload, {
  MessInfoProvider? messInfoProvider,
  RoomCleaningProvider? roomCleaningProvider,
  bool fetchProfilePictureIfMissing = false,
}) async {
  try {
    final userRaw = payload['user'];
    if (userRaw is Map) {
      await persistUserDetailsFromPayload(
        Map<String, dynamic>.from(userRaw),
        fetchProfilePictureIfMissing: fetchProfilePictureIfMissing,
      );
    }

    final userMessRaw = payload['userMessInfo'];
    if (userMessRaw is Map) {
      await persistUserMessInfoFromPayload(
          Map<String, dynamic>.from(userMessRaw));
    }

    final hostelsRaw = payload['hostels'];
    if (hostelsRaw is List) {
      await HostelsNotifier.init(preloadedHostels: hostelsRaw);
    }

    final messListRaw = payload['allMessInfo'];
    if (messListRaw is List && messInfoProvider != null) {
      messInfoProvider.applyMessInfoList(messListRaw);
    }

    final alertsRaw = payload['alerts'];
    if (alertsRaw is List) {
      await applyAlertsFromServerJson(alertsRaw);
    }

    final roomCleaningRaw = payload['roomCleaningBookings'];
    if (roomCleaningRaw is Map && roomCleaningProvider != null) {
      final bookings = roomCleaningRaw['bookings'];
      if (bookings is List) {
        roomCleaningProvider.applyBookingsFromJson(bookings);
      }
    }

    final todayMenuRaw = payload['todayMenu'];
    if (todayMenuRaw is Map) {
      final day = todayMenuRaw['day']?.toString();
      final messId = todayMenuRaw['messId']?.toString();
      final menus = todayMenuRaw['menus'];
      if (day != null &&
          day.isNotEmpty &&
          messId != null &&
          messId.isNotEmpty &&
          menus is List) {
        seedMenuCache(messId: messId, day: day, menuJson: menus);

        // The server day is computed in IST. To avoid timezone mismatches for
        // cache keys, also prime the cache for the local day when different.
        final localDay = _localWeekdayName();
        if (localDay != day) {
          seedMenuCache(messId: messId, day: localDay, menuJson: menus);
        }
      }
    }

    return true;
  } catch (e) {
    if (kDebugMode) {
      debugPrint('App bootstrap apply failed: $e');
    }
    return false;
  }
}
