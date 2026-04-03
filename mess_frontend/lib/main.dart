import 'dart:async';
import 'package:flutter/material.dart';

import 'constants/themes.dart';
import 'utilities/hq_version_checker.dart';
import 'modules/screens/login_screen.dart';
import 'modules/screens/update_required_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await HqVersionChecker.init();
  final bool updateRequired = await HqVersionChecker.checkForUpdate();

  runApp(MessManagerApp(updateRequired: updateRequired));
}

class MessManagerApp extends StatelessWidget {
  final bool updateRequired;

  const MessManagerApp({super.key, required this.updateRequired});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
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
      home: updateRequired
          ? const UpdateRequiredScreen()
          : const MessManagerLoginScreen(),
    );
  }
}