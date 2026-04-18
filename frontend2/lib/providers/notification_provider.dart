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

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

const AndroidNotificationChannel highImportanceChannel =
    AndroidNotificationChannel(
  'high_importance_channel',
  'High Importance Notifications',
  description: 'Used for important heads-up notifications.',
  importance: Importance.max,
  playSound: true,
);

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  if (kDebugMode) {
    debugPrint('💤 Handling background message: ${message.messageId}');
  }

  bool dataBoolTrue(Map<String, dynamic> data, String key) {
    final v = data[key];
    return v == 'true' || v == true;
  }

  if (dataBoolTrue(Map<String, dynamic>.from(message.data), 'alert')) {
    await NotificationProvider.saveHistoryFromRemoteMessageBackground(message);
    return;
  }

  if (message.notification != null) {
    await NotificationProvider.saveHistoryFromRemoteMessageBackground(message);
  }
}

final NotificationProvider globalNotificationProvider = NotificationProvider();

class NotificationProvider extends ChangeNotifier {
  final Map<String, Timer> _alertProgressTimers = {};
  SharedPreferences? _sharedPrefs;

  List<NotificationModel> notificationHistory = [];
  List<NotificationModel> activeAlerts = [];

  bool feedbackRefresh = false;
  int? tabNavigation;
  String? deepNavigation;
  bool homeScreenRefresh = false;

  GlobalKey<NavigatorState>? globalNavigatorKey;
  bool _fcmTokenRefreshListenerAttached = false;

  void triggerFeedbackRefresh() {
    feedbackRefresh = !feedbackRefresh;
    notifyListeners();
  }

  void setTabNavigation(int? tab) {
    tabNavigation = tab;
    notifyListeners();
  }

  void clearTabNavigation() {
    tabNavigation = null;
  }

  void setDeepNavigation(String? screen) {
    deepNavigation = screen;
    notifyListeners();
  }

  void clearDeepNavigation() {
    deepNavigation = null;
  }

  void triggerHomeScreenRefresh() {
    homeScreenRefresh = true;
    notifyListeners();
  }

  void clearHomeScreenRefresh() {
    homeScreenRefresh = false;
  }

  void setTestingAlerts(List<NotificationModel> alerts) {
    activeAlerts = alerts;
    notifyListeners();
  }

  void setNavigatorKey(GlobalKey<NavigatorState> key) {
    globalNavigatorKey = key;
  }

  Future<void> setupNotificationChannel() async {
    final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
        flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    await androidImplementation
        ?.createNotificationChannel(highImportanceChannel);
  }

  void _updateActiveAlerts() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final active = notificationHistory
        .where((n) => n.isAlert && n.expiresAt > now)
        .toList();
    active.sort((a, b) => a.expiresAt.compareTo(b.expiresAt));
    activeAlerts = active;
    notifyListeners();
  }

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

      if (id != null && id.isNotEmpty) {
        notifications.removeWhere((n) => n.id == id);
      }

      notifications.add(notification);

      final jsonList =
          notifications.map((n) => jsonEncode(n.toJson())).toList();
      await _sharedPrefs?.setStringList('notifications', jsonList);

      notificationHistory = notifications;
      _updateActiveAlerts();

      if (kDebugMode) {
        debugPrint('✅ Saved notification to history: $title: $body');
      }
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error saving notification to history: $e');
    }
  }

  static bool _dataBoolTrue(Map<String, dynamic> data, String key) {
    final v = data[key];
    return v == 'true' || v == true;
  }

  static bool _isAlertFromData(Map<String, dynamic> data) =>
      _dataBoolTrue(data, 'alert') || _dataBoolTrue(data, 'isAlert');

  static bool _hasCountdownFromData(Map<String, dynamic> data) =>
      _dataBoolTrue(data, 'hasCountdown');

  static int _expiresAtFromData(Map<String, dynamic> data) =>
      int.tryParse(data['expiresAt']?.toString() ?? '') ?? 0;

  static int _ttlSecondsFromData(Map<String, dynamic> data) =>
      int.tryParse(data['ttlSeconds']?.toString() ?? '') ?? 0;

  static int _notificationIdForAlertData(Map<String, dynamic> data) {
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

  static bool _shouldPersistHistoryFromMessage(RemoteMessage message) {
    if (message.notification != null) return true;
    final d = Map<String, dynamic>.from(message.data);
    if (!_dataBoolTrue(d, 'alert')) return false;
    final title = d['title']?.toString().trim() ?? '';
    final body = d['body']?.toString().trim() ?? '';
    return title.isNotEmpty || body.isNotEmpty;
  }

  static (String, String) _resolveMessageTitleBody(RemoteMessage message) {
    final nt = message.notification?.title?.trim();
    final nb = message.notification?.body?.trim();
    final dt = message.data['title']?.toString().trim();
    final db = message.data['body']?.toString().trim();

    final title = (nt != null && nt.isNotEmpty)
        ? nt
        : ((dt != null && dt.isNotEmpty) ? dt : 'No Title');
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

  static Future<void> saveHistoryFromRemoteMessageBackground(
      RemoteMessage message) async {
    final data = Map<String, dynamic>.from(message.data);
    final (title, body) = _resolveMessageTitleBody(message);
    final isAlert = _isAlertFromData(data);
    final hasCountdown = _hasCountdownFromData(data);
    final expiresAt = _expiresAtFromData(data);

    final prefs = await SharedPreferences.getInstance();
    final notification = NotificationModel(
      id: data['id']?.toString(),
      title: title,
      body: body,
      redirectType: data['redirectType'] as String?,
      timestamp: DateTime.now(),
      isAlert: isAlert,
      isRead: false,
      hasCountdown: hasCountdown,
      expiresAt: expiresAt,
      targetType: data['targetType'] as String?,
    );

    final jsonList = prefs.getStringList("notifications") ?? [];
    List<NotificationModel> notifications = [];
    for (var jsonString in jsonList) {
      try {
        notifications.add(NotificationModel.fromJson(jsonDecode(jsonString)));
      } catch (_) {}
    }

    final now = DateTime.now();
    notifications = notifications
        .where((notif) => now.difference(notif.timestamp).inDays <= 7)
        .toList();

    if (notification.id != null && notification.id!.isNotEmpty) {
      notifications.removeWhere((n) => n.id == notification.id);
    }
    notifications.add(notification);

    await prefs.setStringList('notifications',
        notifications.map((n) => jsonEncode(n.toJson())).toList());
  }

  List<NotificationModel> _loadNotificationsFromPrefs() {
    try {
      final jsonList = _sharedPrefs?.getStringList("notifications") ?? [];
      List<NotificationModel> notifications = [];
      for (var jsonString in jsonList) {
        try {
          notifications.add(NotificationModel.fromJson(jsonDecode(jsonString)));
        } catch (e) {
          if (kDebugMode) debugPrint('❌ Invalid notification entry: $e');
        }
      }
      return notifications;
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error loading notifications: $e');
      return [];
    }
  }

  List<NotificationModel> _cleanupExpiredNotifications(
      List<NotificationModel> notifications) {
    final now = DateTime.now();
    final filtered = notifications.where((notif) {
      final daysDiff = now.difference(notif.timestamp).inDays;
      return daysDiff <= 7;
    }).toList();

    if (filtered.length != notifications.length) {
      _sharedPrefs?.setStringList('notifications',
          filtered.map((n) => jsonEncode(n.toJson())).toList());
    }
    return filtered;
  }

  Future<void> _updateNotificationsInPrefs(
      List<NotificationModel> notifications) async {
    try {
      final jsonList =
          notifications.map((n) => jsonEncode(n.toJson())).toList();
      await _sharedPrefs?.setStringList('notifications', jsonList);
      notificationHistory = notifications;
      _updateActiveAlerts();
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error updating notifications: $e');
    }
  }

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
          _updateActiveAlerts();
        }
      }
    } catch (e) {
      if (kDebugMode) debugPrint("Error syncing alerts: $e");
      _updateActiveAlerts();
    }
  }

  Future<void> filterAndLoadLocalAlerts() async {
    _sharedPrefs ??= await SharedPreferences.getInstance();
    var notifications = _loadNotificationsFromPrefs();
    notificationHistory = notifications;
    _updateActiveAlerts();
  }

  Future<void> clearAlerts() async {
    activeAlerts = [];
    notificationHistory = [];
    notifyListeners();
    _sharedPrefs ??= await SharedPreferences.getInstance();
    await _sharedPrefs?.remove('notifications');
  }

  Future<void> markNotificationAsRead(int index) async {
    try {
      List<NotificationModel> notifications = _loadNotificationsFromPrefs();
      if (index >= 0 && index < notifications.length) {
        notifications[index] = notifications[index].copyWith(isRead: true);
        await _updateNotificationsInPrefs(notifications);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error marking notification as read: $e');
    }
  }

  Future<void> markAllNotificationsAsRead() async {
    try {
      List<NotificationModel> notifications = _loadNotificationsFromPrefs();
      notifications =
          notifications.map((n) => n.copyWith(isRead: true)).toList();
      await _updateNotificationsInPrefs(notifications);
    } catch (e) {
      if (kDebugMode)
        debugPrint('❌ Error marking all notifications as read: $e');
    }
  }

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
      }
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error marking alerts as read: $e');
    }
  }

  int getUnreadNotificationsCount() {
    final notifications = _loadNotificationsFromPrefs();
    return notifications.where((n) => !n.isRead).length;
  }

  Future<void> initializeFcm() async {
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

    _sharedPrefs = await SharedPreferences.getInstance();
    var notifications = _loadNotificationsFromPrefs();
    notifications = _cleanupExpiredNotifications(notifications);
    notificationHistory = notifications;
    _updateActiveAlerts();

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

    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      if (kDebugMode) debugPrint('🚀 Notification opened: ${message.data}');
      if (_shouldPersistHistoryFromMessage(message)) {
        _saveHistoryFromRemoteMessage(message);
      }
      _handleNotificationNavigation(message.data);
    });

    FirebaseMessaging.instance
        .getInitialMessage()
        .then((RemoteMessage? message) {
      if (message == null) return;
      if (_shouldPersistHistoryFromMessage(message)) {
        _saveHistoryFromRemoteMessage(message);
      }
      _handleNotificationNavigation(message.data);
    });
  }

  void _handleNotificationNavigation(Map<String, dynamic> data) {
    if (data['redirectType'] == null) return;
    final redirectType = data['redirectType'] as String;

    int? targetTab;
    switch (redirectType) {
      case 'mess_screen':
        targetTab = 1;
        triggerFeedbackRefresh();
        break;
      case 'mess_change':
        targetTab = 0;
        setDeepNavigation('mess_change_screen');
        break;
      case 'profile':
        targetTab = 0;
        setDeepNavigation('profile_screen');
        break;
      default:
        return;
    }

    setTabNavigation(targetTab);
  }

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

  void _onNotificationTap(NotificationResponse response) {
    if (kDebugMode) {
      debugPrint('🔔 Local notification tapped: ${response.payload}');
    }
    if (response.payload != null && response.payload!.isNotEmpty) {
      final redirectType = response.payload!;
      _handleNotificationNavigation({'redirectType': redirectType});
    }
  }

  Future<void> registerFcmToken() async {
    try {
      final header = await getAccessToken();
      if (header == 'error') return;

      if (Platform.isIOS) {
        try {
          final settings = await FirebaseMessaging.instance.requestPermission(
            alert: true,
            badge: true,
            sound: true,
            provisional: false,
          );

          if (settings.authorizationStatus == AuthorizationStatus.authorized ||
              settings.authorizationStatus == AuthorizationStatus.provisional) {
            await Future.delayed(const Duration(milliseconds: 2000));
            String? apnsToken = await FirebaseMessaging.instance.getAPNSToken();
            int retries = 0;
            const maxRetries = 20;
            while (apnsToken == null && retries < maxRetries) {
              await Future.delayed(const Duration(milliseconds: 2000));
              apnsToken = await FirebaseMessaging.instance.getAPNSToken();
              retries++;
              if (apnsToken != null) break;
            }
          }
        } catch (_) {}
      }

      String? token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      final dio = DioClient().dio;

      if (!_fcmTokenRefreshListenerAttached) {
        _fcmTokenRefreshListenerAttached = true;
        FirebaseMessaging.instance.onTokenRefresh.listen((fcmToken) async {
          final freshHeader = await getAccessToken();
          if (freshHeader == 'error') return;
          await dio.post(
            NotificationEndpoints.registerToken,
            options: Options(
              headers: {
                'Authorization': 'Bearer $freshHeader',
                'Content-Type': 'application/json',
              },
            ),
            data: jsonEncode({'fcmToken': fcmToken}),
          );
        }).onError((err) {});
      }

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

      if (res.statusCode == 200) {
        await _sendWelcomeNotificationIfNeeded(header);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error registering FCM token: $e');
    }
  }

  Future<void> _sendWelcomeNotificationIfNeeded(String authToken) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final welcomeSent = prefs.getBool('welcome_notification_sent') ?? false;

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
          await prefs.setBool('welcome_notification_sent', true);
        }
      }
    } catch (_) {}
  }

  Future<void> listenNotifications() async {
    await setupNotificationChannel();
    await FirebaseMessaging.instance.requestPermission();
    await initializeFcm();
  }

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
}
