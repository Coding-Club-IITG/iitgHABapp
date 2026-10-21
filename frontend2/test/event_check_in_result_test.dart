import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend2/apis/events/events_api.dart';
import 'package:frontend2/screens/events/event_scanner_screen.dart';

Future<void> pumpPanel(WidgetTester tester, CheckInResult result) {
  return tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: CheckInResultPanel(result: result, onNext: () {}),
    ),
  ));
}

void main() {
  const attendee = EventAttendee(
    name: 'Neha Das',
    rollNumber: '220101002',
    hostelName: 'Kameng',
  );

  testWidgets('allowed scan shows who to let in', (tester) async {
    await pumpPanel(
      tester,
      const CheckInResult(
        outcome: CheckInOutcome.allowed,
        message: 'Entry allowed',
        attendee: attendee,
      ),
    );
    expect(find.text('Entry allowed'), findsOneWidget);
    expect(find.text('Neha Das'), findsOneWidget);
    expect(find.text('220101002'), findsOneWidget);
    expect(find.text('Kameng'), findsOneWidget);
  });

  testWidgets('repeat scan shows when they entered', (tester) async {
    await pumpPanel(
      tester,
      CheckInResult(
        outcome: CheckInOutcome.alreadyEntered,
        message: 'Already entered',
        attendee: attendee,
        checkedInAt: DateTime(2026, 10, 24, 19, 12),
      ),
    );
    expect(find.text('Already entered'), findsOneWidget);
    expect(find.text('Scanned at 7:12 PM, 24 Oct'), findsOneWidget);
  });

  testWidgets('denied scan shows the reason', (tester) async {
    await pumpPanel(
      tester,
      const CheckInResult(
        outcome: CheckInOutcome.denied,
        message: 'This QR is for a different event',
      ),
    );
    expect(find.text('Entry denied'), findsOneWidget);
    expect(find.text('This QR is for a different event'), findsOneWidget);
  });
}
