import 'package:flutter/material.dart';

/// Shared colors and surfaces used across Home, sheets, and list cards.
/// (Mirrors [_HomeScreenState] styling in `home_screen.dart`.)
abstract final class AppUi {
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE6E6E6);
  static const Color sectionDivider = Color(0xFFF0F0F0);
  static const Color shadow = Color(0x14000000);

  static const Color textPrimary = Color(0xFF2E2F31);
  static const Color textSecondary = Color(0xFF676767);
  static const Color textMuted = Color(0xFF939393);

  static const Color primary = Color(0xFF4C4EDB);
  static const Color primarySoft = Color(0xFFEDEDFB);

  /// Notification / info accent (matches Updates card on Home).
  static const Color blueSoft = Color(0xFFE0F1FF);
  static const Color blue = Color(0xFF3182CE);

  static const Color yellow = Color(0xFFA36500);
  static const Color yellowSoft = Color(0xFFFFFAEB);

  /// Drag handle on modal sheets (see `mess_preference`, `qr_scanner`).
  static const Color sheetHandle = Color(0xFFE0E0E0);

  static List<BoxShadow> get cardShadow => const [
        BoxShadow(
          color: shadow,
          blurRadius: 16,
          offset: Offset.zero,
        ),
      ];

  static BoxDecoration cardDecoration({
    double radius = 16,
    Color? borderColor,
    Color? backgroundColor,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? surface,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor ?? border),
      boxShadow: cardShadow,
    );
  }

  static const TextStyle sheetTitle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 24 / 18,
    color: textPrimary,
  );

  static const TextStyle sheetSubtitle = TextStyle(
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w400,
    color: textSecondary,
  );
}
