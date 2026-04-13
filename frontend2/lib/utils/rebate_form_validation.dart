/// Datatype / format checks for mess rebate and station-leave forms.
library;

class RebateFormValidation {
  RebateFormValidation._();

  static String _digitsOnly(String s) =>
      s.replaceAll(RegExp(r'\D'), '');

  /// Indian mobile: optional +91 / 91 prefix, then 10 digits starting 6–9.
  static bool isValidIndianMobile(String raw) {
    var t = raw.trim().replaceAll(RegExp(r'\s'), '');
    if (t.isEmpty) return false;
    if (t.startsWith('+91')) {
      t = t.substring(3);
    } else if (t.startsWith('91') && t.length >= 12) {
      t = t.substring(2);
    }
    final d = _digitsOnly(t);
    return RegExp(r'^[6-9]\d{9}$').hasMatch(d);
  }

  /// Emergency contact: same as mobile, or 10–12 digit numeric (STD + number).
  static bool isValidIndiaContactPhone(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return false;
    if (isValidIndianMobile(t)) return true;
    final d = _digitsOnly(t);
    if (d.length < 10 || d.length > 12) return false;
    return RegExp(r'^[1-9]\d{9,11}$').hasMatch(d);
  }

  /// Typical Indian bank account: digits only, 9–18 length.
  static bool isValidBankAccountNumber(String raw) {
    final d = _digitsOnly(raw);
    return RegExp(r'^\d{9,18}$').hasMatch(d);
  }

  /// IFSC: 4 letters, literal 0, then 6 alphanumeric (e.g. SBIN0001234).
  static bool isValidIFSC(String raw) {
    final s = raw.trim().toUpperCase();
    return RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(s);
  }

  /// Room / hostel token: letters, digits, space, hyphen, slash.
  static bool isValidRoomNumber(String raw) {
    final s = raw.trim();
    if (s.isEmpty) return false;
    return RegExp(r'^[A-Za-z0-9 \-/]{1,32}$').hasMatch(s);
  }

  /// Optional email: empty is valid; otherwise basic RFC-like shape.
  static bool isValidOptionalEmail(String raw) {
    final s = raw.trim();
    if (s.isEmpty) return true;
    return RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    ).hasMatch(s);
  }

  /// Semester label: non-empty printable text, reasonable length (no control chars).
  static bool isValidSemesterDisplay(String raw) {
    final s = raw.trim();
    if (s.isEmpty || s.length > 64) return false;
    return !RegExp(r'[\x00-\x08\x0b\x0c\x0e-\x1f]').hasMatch(s);
  }
}
