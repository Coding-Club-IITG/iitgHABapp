class GalaScanLog {
  final String userId;
  final String userName;
  final String rollNumber;
  final String mealType;
  final String time;
  final bool alreadyScanned;

  GalaScanLog({
    required this.userId,
    required this.userName,
    required this.rollNumber,
    required this.mealType,
    required this.time,
    required this.alreadyScanned,
  });

  factory GalaScanLog.fromJson(Map<String, dynamic> json) {
    final user = json['user'] is Map<String, dynamic>
        ? json['user'] as Map<String, dynamic>
        : <String, dynamic>{};
    return GalaScanLog(
      userId: user['_id']?.toString() ?? '',
      userName: user['name']?.toString() ?? '',
      rollNumber: user['rollNumber']?.toString() ?? '',
      mealType: json['mealType']?.toString() ?? '',
      time: json['time']?.toString() ?? '',
      alreadyScanned: json['alreadyScanned'] == true,
    );
  }
}
