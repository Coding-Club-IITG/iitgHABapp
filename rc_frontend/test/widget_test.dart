import 'package:flutter_test/flutter_test.dart';

import 'package:rc_frontend/main.dart';

void main() {
  testWidgets('HABit RC app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const HabitRcApp(updateRequired: false));

    // Verify that HABit RC title is rendered.
    expect(find.text('HABit RC'), findsOneWidget);
  });
}
