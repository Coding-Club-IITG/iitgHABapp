import 'recent_entry.dart';

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
