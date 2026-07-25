import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend2/main.dart';
import 'package:frontend2/providers/feedback_provider.dart';
import 'package:frontend2/providers/mess_info_provider.dart';
import 'package:frontend2/providers/notification_provider.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets('Frontend2 app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => MessInfoProvider()),
          ChangeNotifierProvider(create: (_) => FeedbackProvider()),
          ChangeNotifierProvider(create: (_) => RoomCleaningProvider()),
          ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ],
        child: const MyApp(isLoggedIn: false, updateRequired: false),
      ),
    );
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
