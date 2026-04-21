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
          fillColor: Themes.shimmerHighlight,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Themes.shimmerBase),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Themes.shimmerBase),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Themes.kAccent, width: 1.5),
          ),
          hintStyle: TextStyle(color: Colors.black54, fontSize: 14),
        ),
      ),
      routerConfig: router,
    );
  }
}
