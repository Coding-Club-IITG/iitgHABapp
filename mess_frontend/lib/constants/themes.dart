import 'package:flutter/material.dart';

class Themes {
  static const kYellow = Color.fromRGBO(254, 207, 111, 1);
  static const kAccent = Color(0xFF4C4EDB);
  static const kFont = "GeneralSans";

  static const pageBg = Color(0xFFF7F7F7);
  static const surface = Colors.white;
  static const surfaceSoft = Color(0xFFF2F2F2);
  static const border = Color(0xFFE6E6E6);
  static const textPrimary = Color(0xFF2E2F31);
  static const textSecondary = Color(0xFF676767);
  static const successSoft = Color(0xFFEDF7F2);
  static const success = Color(0xFF1F8441);
  static const warningSoft = Color(0xFFF1F5F9);
  static const warning = Color(0xFF475569);
  static const shimmerBase = Color(0xFFF2F2F2);
  static const shimmerHighlight = Color(0xFFF9F9F9);

  static ThemeData buildAppTheme() {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: kAccent,
          brightness: Brightness.light,
        ).copyWith(
          primary: kAccent,
          secondary: Colors.black,
          surface: surface,
          surfaceTint: Colors.transparent,
          surfaceContainerLowest: surface,
          surfaceContainerLow: pageBg,
          surfaceContainer: surfaceSoft,
          surfaceContainerHigh: const Color(0xFFECECEC),
          surfaceContainerHighest: border,
        );

    final noTint = WidgetStateProperty.all(Colors.transparent);
    final baseTypography = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
    ).textTheme;

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: kFont,
      scaffoldBackgroundColor: pageBg,
      canvasColor: surface,
      primaryColor: kYellow,
      splashColor: kYellow,
      textTheme: baseTypography.apply(
        fontFamily: kFont,
        bodyColor: textPrimary,
        displayColor: textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: border),
        ),
      ),
      dialogTheme: const DialogThemeData(surfaceTintColor: Colors.transparent),
      bottomSheetTheme: const BottomSheetThemeData(
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: const Color(0xFFEDEDFB),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? kAccent
                : textSecondary,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: kFont,
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? textPrimary
                : textSecondary,
          ),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          surfaceTintColor: noTint,
          backgroundColor: WidgetStateProperty.all(kAccent),
          foregroundColor: WidgetStateProperty.all(Colors.white),
          padding: WidgetStateProperty.all(
            const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          textStyle: WidgetStateProperty.all(
            const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          surfaceTintColor: noTint,
          backgroundColor: WidgetStateProperty.all(kAccent),
          foregroundColor: WidgetStateProperty.all(Colors.white),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          surfaceTintColor: noTint,
          foregroundColor: WidgetStateProperty.all(textPrimary),
          side: WidgetStateProperty.all(const BorderSide(color: border)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          surfaceTintColor: noTint,
          foregroundColor: WidgetStateProperty.all(kAccent),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceSoft,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: kAccent, width: 1.5),
        ),
        hintStyle: const TextStyle(color: textSecondary, fontSize: 14),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surface,
        selectedColor: const Color(0xFFEDEDFB),
        secondarySelectedColor: const Color(0xFFEDEDFB),
        side: const BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        labelStyle: const TextStyle(
          color: textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: Color(0xFF111827),
        contentTextStyle: TextStyle(color: Colors.white),
      ),
      dividerTheme: const DividerThemeData(
        color: border,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: kAccent),
    );
  }
}
