import 'dart:typed_data';

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

class SectionData {
  final String label;
  final List<RecentEntry> entries;
  final String emptyText;

  const SectionData({
    required this.label,
    required this.entries,
    required this.emptyText,
  });
}

class RecentEntry {
  final String name;
  final String rollNumber;
  final String time;
  final String userId;

  const RecentEntry({
    required this.name,
    required this.rollNumber,
    required this.time,
    required this.userId,
  });
}

class ManagerProfileData {
  final Map<String, dynamic> profile;
  final Uint8List? pictureBytes;

  ManagerProfileData({
    required this.profile,
    required this.pictureBytes,
  });
}

List<RecentEntry> mapRecent(dynamic raw) {
  if (raw is! List) return const [];
  return raw.map<RecentEntry>((item) {
    final m = item as Map<String, dynamic>;
    return RecentEntry(
      name: (m['name'] ?? '') as String,
      rollNumber: (m['rollNumber'] ?? '') as String,
      time: (m['time'] ?? '') as String,
      userId: (m['userId'] ?? '') as String,
    );
  }).toList();
}

String formatScanTime(String raw) {
  final dt = DateTime.tryParse(raw)?.toLocal();
  if (dt != null) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  final regex = RegExp(r'(\d{1,2}:\d{2})');
  final match = regex.firstMatch(raw);
  if (match != null) {
    return match.group(1)!;
  }

  return raw;
}

DateTime parseScanTimeForSort(String raw) {
  final iso = DateTime.tryParse(raw);
  if (iso != null) return iso;

  final regex = RegExp(r'(\d{1,2}):(\d{2})');
  final match = regex.firstMatch(raw);
  if (match != null) {
    final h = int.tryParse(match.group(1)!);
    final m = int.tryParse(match.group(2)!);
    if (h != null && m != null) {
      final now = DateTime.now();
      return DateTime(now.year, now.month, now.day, h, m);
    }
  }

  return DateTime.fromMillisecondsSinceEpoch(0);
}