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

List<RecentEntry> mapRecentFromApi(dynamic raw) {
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
