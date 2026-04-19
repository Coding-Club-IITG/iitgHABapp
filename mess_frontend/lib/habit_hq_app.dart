import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'constants/themes.dart';

class HabitHqApp extends StatelessWidget {
  const HabitHqApp({super.key, required this.router});

  final GoRouter router;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'HABit HQ',
      theme: Themes.theme.copyWith(
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Color(0xFFF9FAFB),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFFE5E7EB)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFFE5E7EB)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFF4C4EDB), width: 1.5),
          ),
          hintStyle: TextStyle(color: Color(0xFF6B7280), fontSize: 14),
        ),
      ),
      routerConfig: router,
    );
  }
}
