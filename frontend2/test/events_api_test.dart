import 'package:flutter_test/flutter_test.dart';
import 'package:frontend2/apis/events/events_api.dart';

void main() {
  test('parses an approved registration with its QR', () {
    final event = CampusEvent.fromJson({
      '_id': 'e1',
      'title': 'Alcheringa Pronite',
      'venue': 'Auditorium',
      'startsAt': '2026-11-01T14:30:00.000Z',
      'endsAt': null,
      'registrationClosesAt': '2099-11-01T14:30:00.000Z',
      'requiresApproval': true,
      'capacity': 100,
      'seatsLeft': 0,
      'isVolunteer': true,
      'myRegistration': {
        'status': 'approved',
        'qrPayload': 'habit-event:e1:abc',
        'checkedInAt': null,
      },
    });

    expect(event.title, 'Alcheringa Pronite');
    expect(event.isVolunteer, isTrue);
    expect(event.isFull, isTrue);
    expect(event.registrationOpen, isTrue);
    expect(event.myRegistration!.isApproved, isTrue);
    expect(event.myRegistration!.qrPayload, 'habit-event:e1:abc');
    expect(event.myRegistration!.checkedInAt, isNull);
  });

  test('unlimited events are never full and unregistered users have no QR', () {
    final event = CampusEvent.fromJson({
      '_id': 'e2',
      'title': 'Open Mic',
      'startsAt': '2026-11-01T14:30:00.000Z',
      'registrationClosesAt': '2000-01-01T00:00:00.000Z',
      'capacity': 0,
      'seatsLeft': null,
      'myRegistration': null,
    });

    expect(event.isFull, isFalse);
    expect(event.registrationOpen, isFalse);
    expect(event.myRegistration, isNull);
  });
}
