import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hive/hive.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/mess/mess_menu.dart';
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:frontend2/providers/notification_provider.dart';
import 'package:frontend2/providers/mess_info_provider.dart';

const Duration kAppBootstrapTtl = Duration(hours: 6);
const String _kBootstrapBoxName = 'app_bootstrap_cache';
const String _kBootstrapKey = 'payload';
const String _kBootstrapFetchedAtKey = 'fetchedAtMs';
const String _kBootstrapUserIdKey = 'userId';
const String _kBootstrapCurrMessKey = 'currMess';

class AppBootstrapCache {
  static Map<String, dynamic>? _data;
  static DateTime? _fetchedAt;

  /// Latest bootstrap payload from the server (same backing store as [set]).
  ///
  /// Unlike [getFresh], this is not TTL-gated: use it for read-only UI hints
  /// (e.g. upcoming gala on the home screen) when a stale snapshot is fine.
  /// Null until the first successful [set]. Cleared by [clear].
  static Map<String, dynamic>? get lastSnapshot => _data;

  static Future<void> set(Map<String, dynamic> data) async {
    _data = data;
    _fetchedAt = DateTime.now();
    try {
      final box = await Hive.openBox(_kBootstrapBoxName);
      String? userId;
      String? currMess;
      final userRaw = data['user'];
      if (userRaw is Map) {
        userId = userRaw['_id']?.toString();
        final cm = userRaw['curr_subscribed_mess'];
        if (cm is Map) {
          currMess = cm['_id']?.toString();
        } else if (cm != null) {
          currMess = cm.toString();
        }
      }
      await box.put(_kBootstrapKey, data);
      await box.put(
          _kBootstrapFetchedAtKey, DateTime.now().millisecondsSinceEpoch);
      await box.put(_kBootstrapUserIdKey, userId);
      await box.put(_kBootstrapCurrMessKey, currMess);
    } catch (_) {
      // Best-effort persistence; keep in-memory cache even if Hive fails.
    }
  }

  static Map<String, dynamic>? getFresh({
    Duration maxAge = kAppBootstrapTtl,
  }) {
    if (_data == null || _fetchedAt == null) return null;
    final age = DateTime.now().difference(_fetchedAt!);
    if (age > maxAge) return null;
    return _data;
  }

  static Future<void> clear() async {
    _data = null;
    _fetchedAt = null;
    try {
      final box = await Hive.openBox(_kBootstrapBoxName);
      await box.delete(_kBootstrapKey);
      await box.delete(_kBootstrapFetchedAtKey);
      await box.delete(_kBootstrapUserIdKey);
      await box.delete(_kBootstrapCurrMessKey);
    } catch (_) {}
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

Future<String?> _safePrefsString(String key) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  } catch (_) {
    return null;
  }
}

Future<Map<String, dynamic>?> _loadPersistedBootstrapIfFresh({
  Duration maxAge = kAppBootstrapTtl,
}) async {
  try {
    final box = await Hive.openBox(_kBootstrapBoxName);
    final fetchedAtMs = box.get(_kBootstrapFetchedAtKey);
    final persistedUserId = box.get(_kBootstrapUserIdKey);
    final persistedCurrMess = box.get(_kBootstrapCurrMessKey);
    final payload = box.get(_kBootstrapKey);

    if (fetchedAtMs is! int) return null;
    if (payload is! Map) return null;

    final age = DateTime.now()
        .difference(DateTime.fromMillisecondsSinceEpoch(fetchedAtMs));
    if (age > maxAge) return null;

    // Avoid cross-user / cross-mess leakage.
    final currentUserId = await _safePrefsString('userId');
    final currentCurrMess = await _safePrefsString('currMess');
    if (currentUserId != null &&
        persistedUserId != null &&
        persistedUserId.toString().isNotEmpty &&
        persistedUserId.toString() != currentUserId) {
      return null;
    }
    if (currentCurrMess != null &&
        persistedCurrMess != null &&
        persistedCurrMess.toString().isNotEmpty &&
        persistedCurrMess.toString() != currentCurrMess) {
      return null;
    }

    final normalized = Map<String, dynamic>.from(payload);
    // Hydrate in-memory cache for quick future reads.
    AppBootstrapCache._data = normalized;
    AppBootstrapCache._fetchedAt =
        DateTime.fromMillisecondsSinceEpoch(fetchedAtMs);
    return normalized;
  } catch (_) {
    return null;
  }
}

Future<Map<String, dynamic>?> fetchAppBootstrapData({
  bool preferFreshCache = true,
}) async {
  if (preferFreshCache) {
    final cached = AppBootstrapCache.getFresh();
    if (cached != null) {
      return cached;
    }

    final persisted = await _loadPersistedBootstrapIfFresh();
    if (persisted != null) return persisted;
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
          await AppBootstrapCache.set(payload);
          return payload;
        }

        // Backward compatible: accept direct payload shape if server omits wrapper.
        if (root.containsKey('user') ||
            root.containsKey('upcomingGala') ||
            root.containsKey('todayMenu')) {
          await AppBootstrapCache.set(root);
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
  bool appliedAny = false;

  // Apply bootstrap in a best-effort way. If one section fails (e.g. due to a
  // shape mismatch), we still want to avoid the expensive fallback startup calls
  // (hostel/all, users/, mess/all, mess/get, alerts) when we have usable cached
  // data for the rest.

  final userRaw = payload['user'];
  if (userRaw is Map) {
    try {
      await persistUserDetailsFromPayload(
        Map<String, dynamic>.from(userRaw),
        fetchProfilePictureIfMissing: fetchProfilePictureIfMissing,
      );
      appliedAny = true;
    } catch (e) {
      if (kDebugMode) debugPrint('App bootstrap: user apply failed: $e');
    }
  }

  // Update HostelsNotifier with curr subscribed mess and summer active flag
  try {
    String? curr;
    bool? summerFlag;
    if (userRaw is Map) {
      final cm = userRaw['curr_subscribed_mess'];
      if (cm is Map) {
        curr = cm['_id']?.toString();
      } else if (cm != null) {
        curr = cm.toString();
      }
    }

    // Tentative locations for summer flag in bootstrap payload — check common shapes
    if (payload.containsKey('summer') && payload['summer'] is Map) {
      summerFlag = payload['summer']['isActive'] == true;
    } else if (payload.containsKey('summerMessStatus') &&
        payload['summerMessStatus'] is Map) {
      final sm = payload['summerMessStatus'] as Map;
      if (sm.containsKey('summer') && sm['summer'] is Map) {
        summerFlag = (sm['summer']['isActive'] == true);
      }
    } else if (payload.containsKey('summerMess') && payload['summerMess'] is Map) {
      summerFlag = payload['summerMess']['isActive'] == true;
    }

    await HostelsNotifier.updateFromBootstrap(curr: curr, summer: summerFlag);
  } catch (_) {}

  final userMessRaw = payload['userMessInfo'];
  if (userMessRaw is Map) {
    try {
      await persistUserMessInfoFromPayload(
          Map<String, dynamic>.from(userMessRaw));
      appliedAny = true;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('App bootstrap: userMessInfo apply failed: $e');
      }
    }
  } else {
    try {
      await clearUserMessInfoFromPrefs();
      appliedAny = true;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('App bootstrap: userMessInfo clear failed: $e');
      }
    }
  }

  final hostelsRaw = payload['hostels'];
  if (hostelsRaw is List) {
    try {
      await HostelsNotifier.init(preloadedHostels: hostelsRaw);
      appliedAny = true;
    } catch (e) {
      if (kDebugMode) debugPrint('App bootstrap: hostels apply failed: $e');
    }
  }

  final messListRaw = payload['allMessInfo'];
  if (messListRaw is List && messInfoProvider != null) {
    try {
      messInfoProvider.applyMessInfoList(messListRaw);
      appliedAny = true;
    } catch (e) {
      if (kDebugMode) debugPrint('App bootstrap: allMessInfo apply failed: $e');
    }
  }

  final alertsRaw = payload['alerts'];
  if (alertsRaw is List) {
    try {
      await globalNotificationProvider.applyAlertsFromServerJson(alertsRaw);
      appliedAny = true;
    } catch (e) {
      if (kDebugMode) debugPrint('App bootstrap: alerts apply failed: $e');
    }
  }

  final roomCleaningRaw = payload['roomCleaningBookings'];
  if (roomCleaningRaw is Map && roomCleaningProvider != null) {
    try {
      final bookings = roomCleaningRaw['bookings'];
      if (bookings is List) {
        roomCleaningProvider.applyBookingsFromJson(bookings);
        appliedAny = true;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('App bootstrap: roomCleaning apply failed: $e');
      }
    }
  }

  final todayMenuRaw = payload['todayMenu'];
  if (todayMenuRaw is Map) {
    try {
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
        appliedAny = true;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('App bootstrap: todayMenu seed failed: $e');
    }
  }

  return appliedAny;
}
