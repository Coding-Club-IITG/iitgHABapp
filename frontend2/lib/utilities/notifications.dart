// notifications.dart

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/apis/protected.dart';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/utilities/alert_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/models/notification_model.dart';
import 'package:firebase_core/firebase_core.dart';

// ✅ Create a global instance of FlutterLocalNotificationsPlugin
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

// ✅ Global variable to store SharedPreferences for notification history
SharedPreferences? _sharedPrefs;

// ✅ Global ValueNotifier for notification updates (can be listened to by UI)
final ValueNotifier<List<NotificationModel>> notificationHistoryNotifier =
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

// ✅ Helper function to save notification to SharedPreferences for history
Future<void> _saveNotificationToHistory(String title, String body,
    {String? redirectType, bool isAlert = false}) async {
  try {
    _sharedPrefs ??= await SharedPreferences.getInstance();

    final notification = NotificationModel(
      title: title,
      body: body,
      redirectType: redirectType,
      timestamp: DateTime.now(),
      isAlert: isAlert,
      isRead: redirectType == null, 
    );

    List<NotificationModel> notifications = _loadNotificationsFromPrefs();
    notifications = _cleanupExpiredNotifications(notifications);
    notifications.add(notification);

    final jsonList = notifications.map((n) => jsonEncode(n.toJson())).toList();
    await _sharedPrefs?.setStringList('notifications', jsonList);

    notificationHistoryNotifier.value = notifications;
    if (kDebugMode) {
      debugPrint(
          '✅ Saved notification to history: $title: $body (isAlert: $isAlert)');
    }
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error saving notification to history: $e');
  }
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
        // Try legacy string format
        try {
          notifications.add(NotificationModel.fromLegacyString(jsonString));
        } catch (_) {
          // Skip invalid entries
        }
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
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Error updating notifications: $e');
  }
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

// ✅ Get unread notifications count
int getUnreadNotificationsCount() {
  final notifications = _loadNotificationsFromPrefs();
  return notifications.where((n) => !n.isRead).length;
}

// ✅ Get active alerts (less than 2 hours old)
List<NotificationModel> getActiveAlerts() {
  final notifications = _loadNotificationsFromPrefs();
  return notifications.where((n) => n.isAlertActive).toList();
}

// ✅ Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Ensure Firebase is initialized for the background isolate
  await Firebase.initializeApp();

  if (kDebugMode) {
    debugPrint('💤 Handling background message: ${message.messageId}');
  }

  // --- SCENARIO 1: Unified Alert System (Mixed Payload) ---
  if (message.data.containsKey('alert') && message.data['alert'] == 'true') {
    // ⚠️ CRITICAL: Only save to AlertsManager. 
    // Do NOT call flutterLocalNotificationsPlugin.show() here.
    // Firebase automatically shows the system notification from the mixed payload!
    await AlertsManager.addAlertFromFCM(message.data);
    return; 
  }

  // --- SCENARIO 2: Standard FCM Notifications (History Tracking) ---
  if (message.notification != null) {
    if (kDebugMode) {
      debugPrint('💤 Standard notification received in background');
    }
    
    final redirectType = message.data['redirectType'];
    final isAlert = message.data['isAlert'] == 'true' || message.data['isAlert'] == true;
    
    await _saveNotificationToHistory(
      message.notification!.title ?? 'No Title',
      message.notification!.body ?? 'No Body',
      redirectType: redirectType,
      isAlert: isAlert,
    );
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

  // ✅ Foreground message handler
  FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
    if (kDebugMode) {
      debugPrint('📩 Foreground message received: ${message.messageId}');
    }

    // 1. Handle incoming Active Alerts
    if (message.data.containsKey('alert') && message.data['alert'] == 'true') {
       await AlertsManager.addAlertFromFCM(message.data);
       // We DO NOT return here if we also want the alert to show up in the standard Notification History tab
    }

    // 2. Handle Standard Notifications
    if (message.notification != null) {
      final redirectType = message.data['redirectType'];
      final isAlert =
          message.data['isAlert'] == 'true' || message.data['isAlert'] == true;
      _saveNotificationToHistory(
        message.notification!.title ?? 'No Title',
        message.notification!.body ?? 'No Body',
        redirectType: redirectType,
        isAlert: isAlert,
      );
      // Show local notification with redirect data
      _showLocalNotification(message.notification!, redirectType);
    }
  });

  // ✅ Notification tap handler (when app is opened via notification)
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    if (kDebugMode) debugPrint('🚀 Notification opened: ${message.data}');
    if (message.notification != null) {
      final redirectType = message.data['redirectType'];
      final isAlert =
          message.data['isAlert'] == 'true' || message.data['isAlert'] == true;
      _saveNotificationToHistory(
        message.notification!.title ?? 'No Title',
        message.notification!.body ?? 'No Body',
        redirectType: redirectType,
        isAlert: isAlert,
      );
    }
    // Handle navigation based on data
    _handleNotificationNavigation(message.data);
  });

  // Handle notification when app is opened from terminated state
  FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
    if (message != null && message.notification != null) {
      if (kDebugMode) debugPrint('🔁 App opened from terminated via notification');
      final redirectType = message.data['redirectType'];
      final isAlert =
          message.data['isAlert'] == 'true' || message.data['isAlert'] == true;
      _saveNotificationToHistory(
        message.notification!.title ?? 'No Title',
        message.notification!.body ?? 'No Body',
        redirectType: redirectType,
        isAlert: isAlert,
      );
      // Handle navigation based on data
      _handleNotificationNavigation(message.data);
    }
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
    RemoteNotification notification, String? redirectType) {
  const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
    'high_importance_channel', // ✅ match manifest + setupNotificationChannel()
    'High Importance Notifications',
    importance: Importance.max,
    priority: Priority.high,
    playSound: true,
  );

  const NotificationDetails notificationDetails =
      NotificationDetails(android: androidDetails);

  // Use redirect type as payload for tap handling
  flutterLocalNotificationsPlugin.show(
    redirectType != null ? redirectType.hashCode : 0,
    notification.title,
    notification.body,
    notificationDetails,
    payload: redirectType,
  );
}

// ✅ Handler for local notification taps
@pragma('vm:entry-point')
void _onNotificationTap(NotificationResponse response) {
  if (kDebugMode) debugPrint('🔔 Local notification tapped: ${response.payload}');
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
      if (kDebugMode) debugPrint('⚠️ Cannot register FCM token: User not authenticated');
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

// ✅ Exposed helper functions for UI access
// These are already accessible through the module, but keeping for explicit access
