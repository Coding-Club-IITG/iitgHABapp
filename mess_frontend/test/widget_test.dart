// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mess_frontend/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build the app with a placeholder updateRequired (test runs before async main).
    await tester.pumpWidget(
      const MessManagerApp(updateRequired: false),
    );

    // Should show login screen (hostel dropdown, etc.)
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
