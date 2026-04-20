class MonthYear {
  const MonthYear(this.month, this.year);
  final int month;
  final int year;

  @override
  bool operator ==(Object other) =>
      other is MonthYear && other.month == month && other.year == year;

  @override
  int get hashCode => Object.hash(month, year);
}

String monthYearLabel(MonthYear my) {
  const names = <String>[
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  final m = (my.month >= 1 && my.month <= 12) ? names[my.month - 1] : 'Month';
  return '$m ${my.year}';
}

DateTime? safeParseIsoDate(dynamic v) {
  final s = v?.toString().trim();
  if (s == null || s.isEmpty) return null;
  try {
    return DateTime.parse(s);
  } catch (_) {
    return null;
  }
}

DateTime toIst(DateTime d) {
  final utc = d.isUtc ? d : d.toUtc();
  return utc.add(const Duration(hours: 5, minutes: 30));
}

String formatYyyyMmDdIst(DateTime d) {
  final x = toIst(d);
  final yyyy = x.year.toString().padLeft(4, '0');
  final mm = x.month.toString().padLeft(2, '0');
  final dd = x.day.toString().padLeft(2, '0');
  return '$yyyy-$mm-$dd';
}

String formatDdMmm(DateTime d) {
  final x = toIst(d);
  const m = <String>[
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
    'Dec',
  ];
  final mm = (x.month >= 1 && x.month <= 12) ? m[x.month - 1] : '';
  return '${x.day.toString().padLeft(2, '0')} $mm';
}
