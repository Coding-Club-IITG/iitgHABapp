import '../models/recent_entry.dart';

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

void sortRecentEntriesNewestFirst(List<RecentEntry> entries) {
  entries.sort((a, b) {
    final ta = parseScanTimeForSort(a.time);
    final tb = parseScanTimeForSort(b.time);
    return tb.compareTo(ta);
  });
}
