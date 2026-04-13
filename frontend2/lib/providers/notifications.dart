
// notifications.dart

import 'package:flutter/foundation.dart';
import 'package:frontend2/utilities/notifications.dart';

class NotificationProvider {
  // Delegate to the global notificationHistoryNotifier from notifications.dart
  static ValueNotifier<List<dynamic>> get notificationProvider =>
      notificationHistoryNotifier;

  static void init() {
    // The notifications.dart file handles all initialization
    // This is just a compatibility wrapper
    if (kDebugMode) debugPrint('✅ NotificationProvider initialized (using global notifier)');
  }
}
