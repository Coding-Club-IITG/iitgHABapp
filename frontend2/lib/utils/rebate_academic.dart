/// Department (ZZ) and programme (YY) labels from roll `XXYYZZABC` (9-digit).
library;

const Map<String, String> kRebateDepartmentByZz = {
  '01': 'Computer Science',
  '02': 'Electrical',
  '03': 'Mechanical',
  '04': 'Civil',
  '05': 'Design',
  '06': 'BSBE',
  '07': 'Chemical',
  '08': 'Electrical',
  '21': 'Physics',
  '22': 'Chemical',
  '23': 'Mathematics',
  '41': 'HSS',
  '50': 'Data Science',
  '51': 'Energy',
  '61': 'Data Science',
  '24': 'Business',
  '59': 'Health Science',
  '62': 'Food Science',
};

const Map<String, String> kRebateProgrammeByYy = {
  '00': 'PREP',
  '01': 'BTECH',
  '02': 'BDES',
  '03': 'Bachelor of Science',
  '21': 'MSc',
  '22': 'M.A.',
  '40': 'MBA',
  '41': 'MTech',
  '42': 'MDes',
  '43': 'Energy Sciences and Engineering',
  '61': 'PhD',
  '62': 'PhD',
  '63': 'Dual (MS + PhD)',
};

String? departmentFromRoll(String? roll) {
  if (roll == null || roll.length < 6) return null;
  final s = roll.trim();
  if (!RegExp(r'^\d{9}$').hasMatch(s)) return null;
  final zz = s.substring(4, 6);
  return kRebateDepartmentByZz[zz];
}

String? programmeFromRoll(String? roll) {
  if (roll == null || roll.length < 4) return null;
  final s = roll.trim();
  if (!RegExp(r'^\d{9}$').hasMatch(s)) return null;
  final yy = s.substring(2, 4);
  return kRebateProgrammeByYy[yy];
}

/// IITG-style ordinal from roll batch year (first two digits = YY of 20YY).
///
/// Monsoon (Jul–Nov) and December (after that Monsoon) use odd ordinals:
/// `2 * (calendarYear - admissionYear) + 1`.
///
/// January–June (spring of [calendarYear], or vacation after it) use even ordinals:
/// `2 * (calendarYear - admissionYear)` — e.g. batch 2023, April 2026 → 6 (not 8).
int suggestedSemesterOrdinal(String? roll, DateTime now) {
  if (roll == null || roll.length < 2) return 1;
  final yy = int.tryParse(roll.substring(0, 2)) ?? 0;
  final admissionYear = 2000 + yy;
  final m = now.month;
  if (m >= 7 || m == 12) {
    return 2 * (now.year - admissionYear) + 1;
  }
  return 2 * (now.year - admissionYear);
}
