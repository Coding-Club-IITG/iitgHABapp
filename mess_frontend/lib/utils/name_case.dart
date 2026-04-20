/// Converts a name-ish string to Title Case.
///
/// Examples:
/// - "  ADITYA   SAMAL " -> "Aditya Samal"
/// - "a" -> "A"
String toTitleCase(String input) {
  final s = input.trim();
  if (s.isEmpty) return s;
  final parts = s.split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  return parts
      .map((w) {
        final lower = w.toLowerCase();
        if (lower.length == 1) return lower.toUpperCase();
        return '${lower[0].toUpperCase()}${lower.substring(1)}';
      })
      .join(' ');
}

