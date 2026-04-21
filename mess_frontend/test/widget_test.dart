import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:mess_frontend/habit_hq_app.dart';
import 'package:mess_frontend/navigation/app_router.dart';
import 'package:mess_frontend/providers/auth_controller.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    final auth = AuthController();
    final router = createAppRouter(updateRequired: false, auth: auth);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthController>.value(
        value: auth,
        child: HabitHqApp(router: router),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
