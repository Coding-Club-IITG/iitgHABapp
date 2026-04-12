import 'package:flutter/material.dart';

class Themes {
  static const kYellow = Color.fromRGBO(254, 207, 111, 1);
  static const kAccent = Color(0xFF4C4EDB);
  static const kFont = "GeneralSans";
  static final theme = ThemeData(
    useMaterial3: true,
    primaryColor: kYellow,
    scaffoldBackgroundColor: Colors.white,
    fontFamily: kFont,
    splashColor: kYellow,
    textTheme: const TextTheme(
      labelMedium: TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w800,
        fontSize: 16,
      ),
      labelSmall: TextStyle(
          fontSize: 14.0, fontWeight: FontWeight.w700, color: Colors.white),
      displayLarge: TextStyle(
          fontWeight: FontWeight.w700, color: Colors.white, fontSize: 28),
      displayMedium: TextStyle(
          fontWeight: FontWeight.w800, color: Colors.white, fontSize: 24),
      displaySmall: TextStyle(
        fontSize: 20.0,
        fontWeight: FontWeight.w400,
        color: Colors.white,
      ),
      bodySmall: TextStyle(
          fontWeight: FontWeight.w400, color: Colors.white, fontSize: 12),
      bodyMedium: TextStyle(
        fontSize: 16.0,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
      bodyLarge: TextStyle(
        fontSize: 20.0,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
    ),
    colorScheme: ColorScheme.fromSwatch().copyWith(
      secondary: Colors.black,
      surfaceTint: Colors.transparent,
    ),
  );

  static const darkTextTheme = TextTheme(
    displayMedium: TextStyle(
      fontWeight: FontWeight.w700,
      color: Colors.black,
      fontSize: 18.0,
    ),
    displayLarge: TextStyle(
      fontWeight: FontWeight.w700,
      color: Colors.black,
      fontSize: 24.0,
    ),
    displaySmall: TextStyle(
      fontWeight: FontWeight.w700,
      color: Colors.black,
      fontSize: 12.0,
    ),
    bodyMedium: TextStyle(
      fontWeight: FontWeight.w400,
      color: Colors.black,
      fontSize: 14.0,
    ),
    bodySmall: TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w400,
      color: Colors.black,
    ),
    labelSmall: TextStyle(
      fontWeight: FontWeight.w800,
      color: Colors.black,
      fontSize: 10.0,
    ),
    labelLarge: TextStyle(
        fontFamily: kFont,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: Colors.black),
    labelMedium: TextStyle(
      fontWeight: FontWeight.w800,
      color: Colors.black,
      fontSize: 14.0,
    ),
    bodyLarge: TextStyle(
      fontWeight: FontWeight.w700,
      color: Colors.black,
      fontSize: 14.0,
    ),
  );
  static const feedbackColor = Color.fromRGBO(46, 47, 49, 1);

  static const shimmerBase = Color(0xFFF2F2F2);
  static const shimmerHighlight = Color(0xFFF9F9F9);
}

List<Color> colors = const [
  Color.fromRGBO(219, 206, 255, 1),
  Color.fromRGBO(219, 206, 255, 1),
  Color.fromRGBO(200, 210, 255, 1),
  Color.fromRGBO(200, 210, 255, 1),
  Color.fromRGBO(111, 143, 254, 1),
  Color.fromRGBO(111, 143, 254, 1),
  Color.fromRGBO(237, 244, 146, 1),
  Color.fromRGBO(237, 244, 146, 1),
];
