// notification_model.dart

class NotificationModel {
  final String title;
  final String body;
  final String? redirectType;
  final DateTime timestamp;
  final bool isAlert;
  final bool isRead;

  NotificationModel({
    required this.title,
    required this.body,
    this.redirectType,
    required this.timestamp,
    this.isAlert = false,
    this.isRead = false,
  });

  // Convert to JSON for storage
  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'body': body,
      'redirectType': redirectType,
      'timestamp': timestamp.toIso8601String(),
      'isAlert': isAlert,
      'isRead': isRead,
    };
  }

  // Create from JSON
  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      redirectType: json['redirectType'],
      timestamp: DateTime.parse(json['timestamp']),
      isAlert: json['isAlert'] ?? false,
      isRead: json['isRead'] ?? false,
    );
  }

  // Convert to old string format for backward compatibility
  String toLegacyString() {
    return '$title: $body';
  }

  // Try to parse from old string format
  factory NotificationModel.fromLegacyString(String str,
      {DateTime? timestamp}) {
    final parts = str.split(':');
    return NotificationModel(
      title: parts.first.trim(),
      body: parts.length > 1 ? parts.sublist(1).join(':').trim() : '',
      redirectType: null,
      timestamp: timestamp ?? DateTime.now(),
      isAlert: false,
      isRead: false,
    );
  }

  // Create a copy with updated fields
  NotificationModel copyWith({
    String? title,
    String? body,
    String? redirectType,
    DateTime? timestamp,
    bool? isAlert,
    bool? isRead,
  }) {
    return NotificationModel(
      title: title ?? this.title,
      body: body ?? this.body,
      redirectType: redirectType ?? this.redirectType,
      timestamp: timestamp ?? this.timestamp,
      isAlert: isAlert ?? this.isAlert,
      isRead: isRead ?? this.isRead,
    );
  }

  // Format date and time
  String get formattedDateTime {
    final now = DateTime.now();
    final diff = now.difference(timestamp);

    // If less than a day ago, show just time
    if (diff.inDays == 0) {
      final hour = timestamp.hour;
      final minute = timestamp.minute;
      final period = hour >= 12 ? 'PM' : 'AM';
      final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      final displayMinute = minute.toString().padLeft(2, '0');
      return '$displayHour:$displayMinute $period';
    }

    // Otherwise show date and time
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final day = timestamp.day;
    final month = months[timestamp.month - 1];
    final hour = timestamp.hour;
    final minute = timestamp.minute;
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    final displayMinute = minute.toString().padLeft(2, '0');

    return '$day $month, $displayHour:$displayMinute $period';
  }

  // Check if redirect is available
  bool get hasRedirect {
    return redirectType != null;
  }

  // Check if notification is expired (older than 7 days)
  bool get isExpired {
    final diff = DateTime.now().difference(timestamp);
    return diff.inDays > 7;
  }

  // Check if alert is still active (less than 2 hours old)
  bool get isAlertActive {
    if (!isAlert) return false;
    final diff = DateTime.now().difference(timestamp);
    return diff.inHours < 2;
  }
}
