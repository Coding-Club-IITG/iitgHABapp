class NotificationModel {
  final String? id;
  final String title;
  final String body;
  final String? redirectType;
  final DateTime timestamp;
  final bool isAlert;
  final bool isRead;

  /// When true and [expiresAt] > 0, [isAlertActive] uses server expiry (epoch ms).
  final bool hasCountdown;
  final int expiresAt;
  final String? targetType;

  NotificationModel({
    this.id,
    required this.title,
    required this.body,
    this.redirectType,
    required this.timestamp,
    this.isAlert = false,
    this.isRead = false,
    this.hasCountdown = false,
    this.expiresAt = 0,
    this.targetType,
  });

  // Convert to JSON for storage
  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'title': title,
      'body': body,
      'redirectType': redirectType,
      'timestamp': timestamp.toIso8601String(),
      'isAlert': isAlert,
      'isRead': isRead,
      'hasCountdown': hasCountdown,
      'expiresAt': expiresAt,
      if (targetType != null) 'targetType': targetType,
    };
  }

  // Create from JSON
  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id']?.toString(),
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      redirectType: json['redirectType'],
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
      // FCM / JS often send "true" strings; match [hasCountdown] parsing.
      isAlert: json['isAlert'] == true ||
          json['isAlert'] == 'true' ||
          json['alert'] == true ||
          json['alert'] == 'true',
      isRead: json['isRead'] == true || json['isRead'] == 'true',
      hasCountdown:
          json['hasCountdown'] == 'true' || json['hasCountdown'] == true,
      expiresAt: int.tryParse(json['expiresAt']?.toString() ?? '') ?? 0,
      targetType: json['targetType']?.toString(),
    );
  }

  // Create a copy with updated fields
  NotificationModel copyWith({
    String? id,
    String? title,
    String? body,
    String? redirectType,
    DateTime? timestamp,
    bool? isAlert,
    bool? isRead,
    bool? hasCountdown,
    int? expiresAt,
    String? targetType,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      redirectType: redirectType ?? this.redirectType,
      timestamp: timestamp ?? this.timestamp,
      isAlert: isAlert ?? this.isAlert,
      isRead: isRead ?? this.isRead,
      hasCountdown: hasCountdown ?? this.hasCountdown,
      expiresAt: expiresAt ?? this.expiresAt,
      targetType: targetType ?? this.targetType,
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
}
