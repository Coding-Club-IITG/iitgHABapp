import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/apis/protected.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/models/notification_model.dart';
import 'package:firebase_core/firebase_core.dart';

// ✅ Create a global instance of FlutterLocalNotificationsPlugin
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

/// Foreground Android: one [Timer] per alert [id] to refresh the progress bar.
final Map<String, Timer> _alertProgressTimers = {};

// ✅ Global variable to store SharedPreferences for notification history
SharedPreferences? _sharedPrefs;

// ✅ Global ValueNotifier for notification updates (can be listened to by UI)
final ValueNotifier<List<NotificationModel>> notificationHistoryNotifier =
    ValueNotifier<List<NotificationModel>>([]);

// ✅ Global ValueNotifier for active alerts
final ValueNotifier<List<NotificationModel>> activeAlertsNotifier =
    ValueNotifier<List<NotificationModel>>([]);

// ✅ Global ValueNotifier to trigger feedback card refresh
final ValueNotifier<bool> feedbackRefreshNotifier = ValueNotifier<bool>(false);

// ✅ Global ValueNotifier for tab navigation requests (0=Home, 1=Mess, 2=ComingSoon)
final ValueNotifier<int?> tabNavigationNotifier = ValueNotifier<int?>(null);

// ✅ Global ValueNotifier for deep navigation (for pushing screens like MessChangePreferenceScreen)
final ValueNotifier<String?> deepNavigationNotifier =
    ValueNotifier<String?>(null);

// ✅ Global ValueNotifier to trigger home screen refresh (e.g., after account linking)
final ValueNotifier<bool> homeScreenRefreshNotifier =
    ValueNotifier<bool>(false);

// ✅ Global navigator key reference (set from main.dart to avoid circular imports)
GlobalKey<NavigatorState>? globalNavigatorKey;

bool _fcmTokenRefreshListenerAttached = false;

// ✅ Set the navigator key (called from main.dart)
void setNavigatorKey(GlobalKey<NavigatorState> key) {
  globalNavigatorKey = key;
}

// ✅ Create and register a high-importance channel (for heads-up pop-down)
const AndroidNotificationChannel highImportanceChannel =
    AndroidNotificationChannel(
  'high_importance_channel', // must match manifest value
  'High Importance Notifications',
  description: 'Used for important heads-up notifications.',
  importance: Importance.max,
  playSound: true,
);

Future<void> setupNotificationChannel() async {
  final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
      flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();

  await androidImplementation?.createNotificationChannel(highImportanceChannel);
}

void _updateActiveAlerts() {
  final now = DateTime.now().millisecondsSinceEpoch;
  final activeAlerts = notificationHistoryNotifier.value
      .where((n) => n.isAlert && n.expiresAt > now)
      .toList();
  // Sort them so the one ending soonest is first
  activeAlerts.sort((a, b) => a.expiresAt.compareTo(b.expiresAt));
  activeAlertsNotifier.value = activeAlerts;
}

// ✅ Helper function to save notification to SharedPreferences for history
Future<void> _saveNotificationToHistory(
  String title,
  String body, {
  String? id,
  String? redirectType,
  String? targetType,
  bool isAlert = false,
  bool hasCountdown = false,
  int expiresAt = 0,
}) async {
  try {
    _sharedPrefs ??= await SharedPreferences.getInstance();

    final notification = NotificationModel(
      id: id,
      title: title,
      body: body,
      redirectType: redirectType,
      timestamp: DateTime.now(),
      isAlert: isAlert,
      isRead: false,
      hasCountdown: hasCountdown,
      expiresAt: expiresAt,
      targetType: targetType,
    );

    List<NotificationModel> notifications = _loadNotificationsFromPrefs();
    notifications = _cleanupExpiredNotifications(notifications);

    // Deduplicate by ID if present
    if (id != null && id.isNotEmpty) {
      notifications.removeWhere((n) => n.id == id);
    }

    notifications.add(notification);

    final jsonList = notifications.map((n) => jsonEncode(n.toJson())).toList();
    await _sharedPrefs?.setStringList('notifications', jsonList);

    notificationHistoryNotifier.value = notifications;
    _updateActiveAlerts();

    if (kDebugMode) {
      debugPrint(
          '✅ Saved notification to history: $title: $body (isAlert: $isAlert)');
    }
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error saving notification to history: $e');
  }
}

// --- FCM payload helpers (server: alert uses `alert` + `expiresAt`, not always `isAlert`) ---

bool _dataBoolTrue(Map<String, dynamic> data, String key) {
  final v = data[key];
  return v == 'true' || v == true;
}

/// Server [createAlert] sends `alert: "true"`; broadcast alerts may send `isAlert`.
bool _isAlertFromData(Map<String, dynamic> data) =>
    _dataBoolTrue(data, 'alert') || _dataBoolTrue(data, 'isAlert');

bool _hasCountdownFromData(Map<String, dynamic> data) =>
    _dataBoolTrue(data, 'hasCountdown');

int _expiresAtFromData(Map<String, dynamic> data) =>
    int.tryParse(data['expiresAt']?.toString() ?? '') ?? 0;

int _ttlSecondsFromData(Map<String, dynamic> data) =>
    int.tryParse(data['ttlSeconds']?.toString() ?? '') ?? 0;

int _notificationIdForAlertData(Map<String, dynamic> data) {
  final id = data['id']?.toString() ?? '';
  if (id.isEmpty) return 0;
  final n = id.hashCode & 0x7fffffff;
  return n == 0 ? 1 : n;
}

void _cancelAlertProgressTimer(String? alertId) {
  if (alertId == null || alertId.isEmpty) return;
  _alertProgressTimers[alertId]?.cancel();
  _alertProgressTimers.remove(alertId);
}

/// Android: determinate progress (slider-style bar) updating every second until expiry.
void _startAndroidAlertProgressNotification({
  required int notificationId,
  required String alertId,
  required String title,
  required String body,
  required int expiresAt,
  required int ttlSeconds,
  String? redirectPayload,
}) {
  _cancelAlertProgressTimer(alertId);

  var ttlMs = ttlSeconds * 1000;
  if (ttlMs <= 0) {
    final approx = expiresAt - DateTime.now().millisecondsSinceEpoch;
    ttlMs = approx.clamp(1, 1 << 30);
  }

  void tick() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final remaining = expiresAt - now;
    if (remaining <= 0) {
      _cancelAlertProgressTimer(alertId);
      flutterLocalNotificationsPlugin.cancel(notificationId);
      return;
    }
    final progress =
        ttlMs <= 0 ? 0 : ((remaining / ttlMs) * 100).round().clamp(0, 100);
    final android = AndroidNotificationDetails(
      'high_importance_channel',
      'High Importance Notifications',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      // Top-right: live countdown (replaces default “now”) — sits above the progress bar.
      when: expiresAt,
      showWhen: true,
      usesChronometer: true,
      chronometerCountDown: true,
      showProgress: true,
      maxProgress: 100,
      progress: progress,
      indeterminate: false,
      onlyAlertOnce: true,
    );
    flutterLocalNotificationsPlugin.show(
      notificationId,
      title,
      body,
      NotificationDetails(android: android),
      payload: redirectPayload,
    );
  }

  tick();
  _alertProgressTimers[alertId] =
      Timer.periodic(const Duration(seconds: 1), (_) => tick());
}

bool _shouldPersistHistoryFromMessage(RemoteMessage message) {
  if (message.notification != null) return true;
  final d = Map<String, dynamic>.from(message.data);
  if (!_dataBoolTrue(d, 'alert')) return false;
  final title = d['title']?.toString().trim() ?? '';
  final body = d['body']?.toString().trim() ?? '';
  return title.isNotEmpty || body.isNotEmpty;
}

(String, String) _resolveMessageTitleBody(RemoteMessage message) {
  final nt = message.notification?.title?.trim();
  final nb = message.notification?.body?.trim();
  final dt = message.data['title']?.toString().trim();
  final db = message.data['body']?.toString().trim();

  final title = (nt != null && nt.isNotEmpty)
      ? nt
      : ((dt != null && dt.isNotEmpty) ? dt : 'No Title');
  // Prefer data body when present
  final body = (db != null && db.isNotEmpty)
      ? db
      : ((nb != null && nb.isNotEmpty) ? nb : 'No Body');
  return (title, body);
}

Future<void> _saveHistoryFromRemoteMessage(RemoteMessage message) async {
  final data = Map<String, dynamic>.from(message.data);
  final (title, body) = _resolveMessageTitleBody(message);
  final isAlert = _isAlertFromData(data);
  final hasCountdown = _hasCountdownFromData(data);
  final expiresAt = _expiresAtFromData(data);

  await _saveNotificationToHistory(
    title,
    body,
    id: data['id']?.toString(),
    redirectType: data['redirectType'] as String?,
    targetType: data['targetType'] as String?,
    isAlert: isAlert,
    hasCountdown: hasCountdown,
    expiresAt: expiresAt,
  );
}

// ✅ Helper function to load notifications from SharedPreferences
List<NotificationModel> _loadNotificationsFromPrefs() {
  try {
    final jsonList = _sharedPrefs?.getStringList("notifications") ?? [];
    List<NotificationModel> notifications = [];

    for (var jsonString in jsonList) {
      try {
        final json = jsonDecode(jsonString);
        notifications.add(NotificationModel.fromJson(json));
      } catch (e) {
        // Skip invalid entries
        if (kDebugMode) debugPrint('❌ Invalid notification entry: $e');
      }
    }

    return notifications;
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error loading notifications: $e');
    return [];
  }
}

// ✅ Cleanup expired notifications (older than 7 days)
List<NotificationModel> _cleanupExpiredNotifications(
    List<NotificationModel> notifications) {
  final now = DateTime.now();
  final filtered = notifications.where((notif) {
    final daysDiff = now.difference(notif.timestamp).inDays;
    return daysDiff <= 7;
  }).toList();

  // If items were removed, save back to SharedPreferences
  if (filtered.length != notifications.length) {
    _sharedPrefs?.setStringList(
        'notifications', filtered.map((n) => jsonEncode(n.toJson())).toList());
    if (kDebugMode) {
      debugPrint(
          '🧹 Cleaned up ${notifications.length - filtered.length} expired notifications');
    }
  }

  return filtered;
}

// ✅ Helper to update notifications in SharedPreferences
Future<void> _updateNotificationsInPrefs(
    List<NotificationModel> notifications) async {
  try {
    final jsonList = notifications.map((n) => jsonEncode(n.toJson())).toList();
    await _sharedPrefs?.setStringList('notifications', jsonList);
    notificationHistoryNotifier.value = notifications;
    _updateActiveAlerts();
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error updating notifications: $e');
  }
}

// ✅ Apply alerts from server JSON payload (e.g. bootstrap)
Future<void> applyAlertsFromServerJson(List<dynamic> alertsJson) async {
  _sharedPrefs ??= await SharedPreferences.getInstance();
  List<NotificationModel> history = _loadNotificationsFromPrefs();
  bool changed = false;

  for (var e in alertsJson) {
    if (e is! Map) continue;
    final data = Map<String, dynamic>.from(e);
    final alertId = data['id']?.toString();

    if (alertId != null && !history.any((n) => n.id == alertId)) {
      final serverAlert = NotificationModel.fromJson({
        ...data,
        'isAlert': true,
        'timestamp': DateTime.now().toIso8601String(),
      });
      history.add(serverAlert);
      changed = true;
    }
  }

  if (changed) {
    history = _cleanupExpiredNotifications(history);
    await _updateNotificationsInPrefs(history);
  } else {
    _updateActiveAlerts();
  }
}

// ✅ Sync active alerts from server
Future<void> syncAlerts() async {
  try {
    final dio = DioClient().dio;
    final response = await dio.get(NotificationEndpoints.getAlerts);
    if (response.statusCode == 200 && response.data['alerts'] != null) {
      _sharedPrefs ??= await SharedPreferences.getInstance();
      final List<dynamic> alertsJson = response.data['alerts'];

      List<NotificationModel> history = _loadNotificationsFromPrefs();
      bool changed = false;

      for (var e in alertsJson) {
        final alertId = e['id']?.toString();
        // Only add if we don't already have an alert with this ID
        if (alertId != null && !history.any((n) => n.id == alertId)) {
          final serverAlert = NotificationModel.fromJson({
            ...e,
            'isAlert': true,
            'timestamp': DateTime.now().toIso8601String(),
          });
          history.add(serverAlert);
          changed = true;
        }
      }

      if (changed) {
        history = _cleanupExpiredNotifications(history);
        await _updateNotificationsInPrefs(history);
      } else {
        // Even if no new alerts, re-evaluate active alerts
        _updateActiveAlerts();
      }
    }
  } catch (e) {
    if (kDebugMode) debugPrint("Error syncing alerts: $e");
    // Fallback to local cache evaluation
    _updateActiveAlerts();
  }
}

// ✅ The Filter Loop (Run on every App Foreground / Resume)
Future<void> filterAndLoadLocalAlerts() async {
  _sharedPrefs ??= await SharedPreferences.getInstance();
  var notifications = _loadNotificationsFromPrefs();
  notificationHistoryNotifier.value = notifications;
  _updateActiveAlerts();
}

// ✅ Clear notifications/alerts
Future<void> clearAlerts() async {
  activeAlertsNotifier.value = []; // Instantly clear the UI
  notificationHistoryNotifier.value = [];
  _sharedPrefs ??= await SharedPreferences.getInstance();
  await _sharedPrefs?.remove('notifications'); // Wipe the local cache
}

// ✅ Mark notification as read by index
Future<void> markNotificationAsRead(int index) async {
  try {
    List<NotificationModel> notifications = _loadNotificationsFromPrefs();
    if (index >= 0 && index < notifications.length) {
      notifications[index] = notifications[index].copyWith(isRead: true);
      await _updateNotificationsInPrefs(notifications);
      if (kDebugMode) debugPrint('✅ Marked notification $index as read');
    }
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error marking notification as read: $e');
  }
}

// ✅ Mark all notifications as read
Future<void> markAllNotificationsAsRead() async {
  try {
    List<NotificationModel> notifications = _loadNotificationsFromPrefs();
    notifications = notifications.map((n) => n.copyWith(isRead: true)).toList();
    await _updateNotificationsInPrefs(notifications);
    if (kDebugMode) debugPrint('✅ Marked all notifications as read');
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error marking all notifications as read: $e');
  }
}

// ✅ Mark all active alerts as read (e.g. from Updates card)
Future<void> markAllAlertsAsRead() async {
  try {
    List<NotificationModel> notifications = _loadNotificationsFromPrefs();
    bool changed = false;
    final now = DateTime.now().millisecondsSinceEpoch;

    for (int i = 0; i < notifications.length; i++) {
      if (notifications[i].isAlert &&
          !notifications[i].isRead &&
          notifications[i].expiresAt > now) {
        notifications[i] = notifications[i].copyWith(isRead: true);
        changed = true;
      }
    }

    if (changed) {
      await _updateNotificationsInPrefs(notifications);
      if (kDebugMode) debugPrint('✅ Marked all active alerts as read');
    }
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error marking alerts as read: $e');
  }
}

// ✅ Get unread notifications count
int getUnreadNotificationsCount() {
  final notifications = _loadNotificationsFromPrefs();
  return notifications.where((n) => !n.isRead).length;
}

// ✅ Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Ensure Firebase is initialized for the background isolate
  await Firebase.initializeApp();

  if (kDebugMode) {
    debugPrint('💤 Handling background message: ${message.messageId}');
  }

  // --- SCENARIO 1: Unified alert (`alert: true` from server createAlert, etc.) ---
  if (_dataBoolTrue(Map<String, dynamic>.from(message.data), 'alert')) {
    if (_shouldPersistHistoryFromMessage(message)) {
      await _saveHistoryFromRemoteMessage(message);
    }
    return;
  }

  // --- SCENARIO 2: Standard FCM (history only; no unified alert flag) ---
  if (message.notification != null) {
    if (kDebugMode) {
      debugPrint('💤 Standard notification received in background');
    }
    await _saveHistoryFromRemoteMessage(message);
  }
}

// ✅ Initialize local notifications and message listeners
Future<void> initializeFcm() async {
  // Initialize local notifications with tap handler
  const AndroidInitializationSettings androidInit =
      AndroidInitializationSettings('@mipmap/hab_icon');
  const DarwinInitializationSettings iosInit = DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );
  const InitializationSettings initSettings = InitializationSettings(
    android: androidInit,
    iOS: iosInit,
  );
  await flutterLocalNotificationsPlugin.initialize(
    initSettings,
    onDidReceiveNotificationResponse: _onNotificationTap,
  );

  // Register background message handler(done in main)
  // FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  // Initialize SharedPreferences for notification history
  _sharedPrefs = await SharedPreferences.getInstance();
  // Load existing notifications into the ValueNotifier and cleanup expired ones
  var notifications = _loadNotificationsFromPrefs();
  notifications = _cleanupExpiredNotifications(notifications);
  notificationHistoryNotifier.value = notifications;
  _updateActiveAlerts();

  // ✅ Foreground message handler
  FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
    if (kDebugMode) {
      debugPrint('📩 Foreground message received: ${message.messageId}');
    }

    final data = Map<String, dynamic>.from(message.data);

    if (_shouldPersistHistoryFromMessage(message)) {
      await _saveHistoryFromRemoteMessage(message);
      if (message.notification != null) {
        _showLocalNotification(
          message.notification!,
          data['redirectType'] as String?,
          data: data,
        );
      }
    }
  });

  // ✅ Notification tap handler (when app is opened via notification)
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    if (kDebugMode) debugPrint('🚀 Notification opened: ${message.data}');
    if (_shouldPersistHistoryFromMessage(message)) {
      _saveHistoryFromRemoteMessage(message);
    }
    _handleNotificationNavigation(message.data);
  });

  // Handle notification when app is opened from terminated state
  FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
    if (message == null) return;
    if (kDebugMode && _shouldPersistHistoryFromMessage(message)) {
      debugPrint('🔁 App opened from terminated via notification');
    }
    if (_shouldPersistHistoryFromMessage(message)) {
      _saveHistoryFromRemoteMessage(message);
    }
    _handleNotificationNavigation(message.data);
  });
}

// ✅ Helper function to handle notification navigation
void _handleNotificationNavigation(Map<String, dynamic> data) {
  if (data['redirectType'] == null) return;

  final redirectType = data['redirectType'] as String;
  if (kDebugMode) debugPrint('📍 Handling redirect: $redirectType');

  // Map redirect types to tab indices
  int? targetTab;
  switch (redirectType) {
    case 'mess_screen':
      targetTab = 1; // Mess Screen tab
      feedbackRefreshNotifier.value = !feedbackRefreshNotifier.value;
      break;
    case 'mess_change':
      targetTab = 0; // Home Screen tab (Mess Change screen is in HomeScreen)
      deepNavigationNotifier.value = 'mess_change_screen';
      break;
    case 'profile':
      targetTab = 0; // Home Screen tab (Profile screen is in HomeScreen)
      deepNavigationNotifier.value = 'profile_screen';
      break;
    default:
      if (kDebugMode) debugPrint('📍 Unknown redirect type: $redirectType');
      return;
  }

  // Trigger navigation to the appropriate tab
  tabNavigationNotifier.value = targetTab;
  if (kDebugMode) debugPrint('📍 Navigated to tab: $targetTab');
}

// ✅ Helper function to display local notification in foreground
void _showLocalNotification(
  RemoteNotification notification,
  String? redirectType, {
  Map<String, dynamic>? data,
}) {
  final dataMap = data ?? {};
  final hasCountdown = _hasCountdownFromData(dataMap);
  final expiresAt = _expiresAtFromData(dataMap);
  final displayTitle = notification.title ?? '';
  final displayBody = notification.body ?? '';

  final alertIdStr = dataMap['id']?.toString() ?? '';

  // Android + hasCountdown: live determinate progress bar (slider) updated every second.
  if (Platform.isAndroid &&
      hasCountdown &&
      expiresAt > 0 &&
      alertIdStr.isNotEmpty) {
    final ttlSec = _ttlSecondsFromData(dataMap);
    final fallbackTtl =
        ((expiresAt - DateTime.now().millisecondsSinceEpoch) / 1000)
            .ceil()
            .clamp(1, 8640000);
    _startAndroidAlertProgressNotification(
      notificationId: _notificationIdForAlertData(dataMap),
      alertId: alertIdStr,
      title: displayTitle,
      body: displayBody,
      expiresAt: expiresAt,
      ttlSeconds: ttlSec > 0 ? ttlSec : fallbackTtl,
      redirectPayload: redirectType,
    );
    return;
  }

  // Android: chronometer when countdown but no alert id (legacy payloads).
  final AndroidNotificationDetails androidDetails =
      (Platform.isAndroid && hasCountdown && expiresAt > 0)
          ? AndroidNotificationDetails(
              'high_importance_channel',
              'High Importance Notifications',
              importance: Importance.max,
              priority: Priority.high,
              playSound: true,
              when: expiresAt,
              showWhen: true,
              usesChronometer: true,
              chronometerCountDown: true,
            )
          : const AndroidNotificationDetails(
              'high_importance_channel',
              'High Importance Notifications',
              importance: Importance.max,
              priority: Priority.high,
              playSound: true,
            );

  const DarwinNotificationDetails iosDarwin = DarwinNotificationDetails(
    presentAlert: true,
    presentBadge: true,
    presentSound: true,
  );

  final NotificationDetails notificationDetails = NotificationDetails(
    android: androidDetails,
    iOS: iosDarwin,
    macOS: iosDarwin,
  );

  final int id = redirectType != null ? redirectType.hashCode : 0;
  flutterLocalNotificationsPlugin.show(
    id,
    displayTitle,
    displayBody,
    notificationDetails,
    payload: redirectType,
  );
}

// ✅ Handler for local notification taps
@pragma('vm:entry-point')
void _onNotificationTap(NotificationResponse response) {
  if (kDebugMode) {
    debugPrint('🔔 Local notification tapped: ${response.payload}');
  }
  if (response.payload != null && response.payload!.isNotEmpty) {
    final redirectType = response.payload!;
    _handleNotificationNavigation({'redirectType': redirectType});
  }
}

// ✅ Registers or updates the device FCM token on your backend
Future<void> registerFcmToken() async {
  try {
    final header = await getAccessToken();

    // Return early if user is not authenticated
    if (header == 'error') {
      if (kDebugMode) {
        debugPrint('⚠️ Cannot register FCM token: User not authenticated');
      }
      return;
    }

    // On iOS, we need to request permission first, then wait for APNS token before getting FCM token
    if (Platform.isIOS) {
      try {
        // Request notification permission first (required for APNS token on iOS)
        final settings = await FirebaseMessaging.instance.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );

        if (settings.authorizationStatus == AuthorizationStatus.authorized ||
            settings.authorizationStatus == AuthorizationStatus.provisional) {
          // Give AppDelegate time to call registerForRemoteNotifications()
          await Future.delayed(const Duration(milliseconds: 2000));

          // Try to get APNS token - it may take time for iOS to get it from Apple's servers
          String? apnsToken = await FirebaseMessaging.instance.getAPNSToken();

          // Wait for APNS token if not immediately available (retry up to 20 times with delay)
          int retries = 0;
          const maxRetries = 20;
          while (apnsToken == null && retries < maxRetries) {
            await Future.delayed(const Duration(milliseconds: 2000));
            apnsToken = await FirebaseMessaging.instance.getAPNSToken();
            retries++;
            if (apnsToken != null) break;
          }
        }
      } catch (e) {
        // Continue anyway - sometimes APNS token might not be available immediately
      }
    }

    String? token = await FirebaseMessaging.instance.getToken();
    if (token == null) {
      if (kDebugMode) debugPrint('❌ No FCM token received');
      return;
    }

    final dio = DioClient().dio;

    // ✅ Listen for token refresh events and re-register
    if (!_fcmTokenRefreshListenerAttached) {
      _fcmTokenRefreshListenerAttached = true;
      FirebaseMessaging.instance.onTokenRefresh.listen((fcmToken) async {
        // Get fresh access token for each refresh
        final freshHeader = await getAccessToken();
        if (freshHeader == 'error') {
          if (kDebugMode) {
            debugPrint(
                '⚠️ Cannot re-register FCM token: User not authenticated');
          }
          return;
        }

        final res = await dio.post(
          NotificationEndpoints.registerToken,
          options: Options(
            headers: {
              'Authorization': 'Bearer $freshHeader',
              'Content-Type': 'application/json',
            },
          ),
          data: jsonEncode({'fcmToken': fcmToken}),
        );
        if (res.statusCode == 200) {
          if (kDebugMode) debugPrint('🔄 FCM token re-registered: $fcmToken');
        } else {
          if (kDebugMode) debugPrint('❌ Failed to re-register token');
        }
      }).onError((err) {
        if (kDebugMode) debugPrint('❌ Failed to re-register token: $err');
      });
    }

    // ✅ Register the current token
    final res = await dio.post(
      NotificationEndpoints.registerToken,
      options: Options(
        headers: {
          'Authorization': 'Bearer $header',
          'Content-Type': 'application/json',
        },
      ),
      data: jsonEncode({'fcmToken': token}),
    );

    if (kDebugMode) debugPrint('3');
    if (res.statusCode == 200) {
      if (kDebugMode) debugPrint('✅ FCM token registered: $token');

      // Send welcome notification after successful token registration
      // This ensures the FCM token exists before sending
      await _sendWelcomeNotificationIfNeeded(header);
    } else {
      if (kDebugMode) debugPrint('❌ Failed to register token');
    }
  } catch (e) {
    if (kDebugMode) debugPrint('4');
    if (kDebugMode) debugPrint('❌ Error registering FCM token: $e');
  }
}

// Send welcome notification if user hasn't received it yet
Future<void> _sendWelcomeNotificationIfNeeded(String authToken) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final welcomeSent = prefs.getBool('welcome_notification_sent') ?? false;

    // Only send if not already sent
    if (!welcomeSent) {
      final dio = DioClient().dio;
      final res = await dio.post(
        NotificationEndpoints.welcome,
        options: Options(
          headers: {
            'Authorization': 'Bearer $authToken',
            'Content-Type': 'application/json',
          },
        ),
      );

      if (res.statusCode == 200) {
        // Mark as sent to avoid duplicate notifications
        await prefs.setBool('welcome_notification_sent', true);
        if (kDebugMode) debugPrint('✅ Welcome notification sent');
      }
    }
  } catch (e) {
    // Silently fail - welcome notification is not critical
    if (kDebugMode) debugPrint('⚠️ Failed to send welcome notification: $e');
  }
}

// ✅ Request notification permission and initialize listeners
Future<void> listenNotifications() async {
  await setupNotificationChannel();
  await FirebaseMessaging.instance.requestPermission();
  await initializeFcm(); // Initialize handlers after permission granted
  if (kDebugMode) debugPrint('✅ Notification listeners initialized');
}

// ✅ Helper function to get notification history from SharedPreferences
Future<List<NotificationModel>> getNotificationHistory() async {
  try {
    _sharedPrefs ??= await SharedPreferences.getInstance();
    var notifications = _loadNotificationsFromPrefs();
    notifications = _cleanupExpiredNotifications(notifications);
    return notifications;
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error getting notification history: $e');
    return [];
  }
}
