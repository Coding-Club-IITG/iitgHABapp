// alert_model.dart

class AlertModel {
  final String id;
  final String title;
  final String body;
  final bool hasCountdown;
  final int expiresAt;
  final String targetType;
  final bool isRead;

  AlertModel({
    required this.id,
    required this.title,
    required this.body,
    required this.hasCountdown,
    required this.expiresAt,
    required this.targetType,
    this.isRead = false,
  });

  factory AlertModel.fromJson(Map<String, dynamic> json) {
    return AlertModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      // Handle string booleans from FCM payloads
      hasCountdown: json['hasCountdown'] == "true" || json['hasCountdown'] == true,
      // Handle string ints from FCM payloads
      expiresAt: int.tryParse(json['expiresAt'].toString()) ?? 0,
      targetType: json['targetType'] ?? 'global',
      isRead: json['isRead'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'body': body,
      'hasCountdown': hasCountdown ? "true" : "false",
      'expiresAt': expiresAt.toString(),
      'targetType': targetType,
      'isRead': isRead,
    };
  }

  AlertModel copyWith({bool? isRead}) {
    return AlertModel(
      id: id,
      title: title,
      body: body,
      hasCountdown: hasCountdown,
      expiresAt: expiresAt,
      targetType: targetType,
      isRead: isRead ?? this.isRead,
    );
  }
}
