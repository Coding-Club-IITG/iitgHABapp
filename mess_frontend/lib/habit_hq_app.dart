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
      theme: Themes.buildAppTheme(),
      routerConfig: router,
    );
  }
}
