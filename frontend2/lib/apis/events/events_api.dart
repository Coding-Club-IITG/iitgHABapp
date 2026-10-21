import 'package:dio/dio.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/utils/api_error_message.dart';

DateTime? _parseDate(dynamic value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;

class EventRegistrationInfo {
  /// One of `pending`, `approved`, `rejected`.
  final String status;
  final String? qrPayload;
  final DateTime? checkedInAt;

  const EventRegistrationInfo({
    required this.status,
    this.qrPayload,
    this.checkedInAt,
  });

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending';
  bool get isRejected => status == 'rejected';

  factory EventRegistrationInfo.fromJson(Map<String, dynamic> json) {
    return EventRegistrationInfo(
      status: json['status']?.toString() ?? 'pending',
      qrPayload: json['qrPayload'] as String?,
      checkedInAt: _parseDate(json['checkedInAt']),
    );
  }
}

class CampusEvent {
  final String id;
  final String title;
  final String description;
  final String venue;
  final DateTime startsAt;
  final DateTime? endsAt;
  final DateTime? registrationClosesAt;
  final bool requiresApproval;
  final int capacity;
  final int? seatsLeft;
  final bool isVolunteer;
  final EventRegistrationInfo? myRegistration;

  const CampusEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.venue,
    required this.startsAt,
    this.endsAt,
    this.registrationClosesAt,
    required this.requiresApproval,
    required this.capacity,
    this.seatsLeft,
    required this.isVolunteer,
    this.myRegistration,
  });

  bool get registrationOpen =>
      registrationClosesAt == null ||
      DateTime.now().isBefore(registrationClosesAt!);

  bool get isFull => seatsLeft != null && seatsLeft! <= 0;

  factory CampusEvent.fromJson(Map<String, dynamic> json) {
    final reg = json['myRegistration'];
    return CampusEvent(
      id: json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      venue: json['venue']?.toString() ?? '',
      startsAt: _parseDate(json['startsAt']) ?? DateTime.now(),
      endsAt: _parseDate(json['endsAt']),
      registrationClosesAt: _parseDate(json['registrationClosesAt']),
      requiresApproval: json['requiresApproval'] == true,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      seatsLeft: (json['seatsLeft'] as num?)?.toInt(),
      isVolunteer: json['isVolunteer'] == true,
      myRegistration: reg is Map<String, dynamic>
          ? EventRegistrationInfo.fromJson(reg)
          : null,
    );
  }
}

class EventAttendee {
  final String name;
  final String rollNumber;
  final String? profilePictureUrl;
  final String? hostelName;

  const EventAttendee({
    required this.name,
    required this.rollNumber,
    this.profilePictureUrl,
    this.hostelName,
  });

  factory EventAttendee.fromJson(Map<String, dynamic> json) {
    return EventAttendee(
      name: json['name']?.toString() ?? 'Unknown',
      rollNumber: json['rollNumber']?.toString() ?? '',
      profilePictureUrl: json['profilePictureUrl'] as String?,
      hostelName: json['hostelName'] as String?,
    );
  }
}

enum CheckInOutcome { allowed, alreadyEntered, denied }

class CheckInResult {
  final CheckInOutcome outcome;
  final String message;
  final EventAttendee? attendee;
  final DateTime? checkedInAt;

  const CheckInResult({
    required this.outcome,
    required this.message,
    this.attendee,
    this.checkedInAt,
  });
}

class EventsApi {
  final Dio _dio = DioClient().dio;

  Future<List<CampusEvent>> listEvents() async {
    final response = await _dio.get(EventEndpoints.list);
    final list = (response.data['events'] as List<dynamic>? ?? []);
    return list
        .map((e) => CampusEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CampusEvent> getEvent(String eventId) async {
    final response = await _dio.get(EventEndpoints.detail(eventId));
    return CampusEvent.fromJson(response.data['event'] as Map<String, dynamic>);
  }

  /// Returns the updated event and the server's message.
  Future<(CampusEvent, String)> register(String eventId) async {
    final response = await _dio.post(EventEndpoints.register(eventId));
    return (
      CampusEvent.fromJson(response.data['event'] as Map<String, dynamic>),
      response.data['message']?.toString() ?? 'Registered',
    );
  }

  Future<CampusEvent> cancelRegistration(String eventId) async {
    final response = await _dio.delete(EventEndpoints.register(eventId));
    return CampusEvent.fromJson(response.data['event'] as Map<String, dynamic>);
  }

  /// Unlocks the volunteer tab for this event using its access code.
  Future<CampusEvent> joinAsVolunteer(String eventId, String code) async {
    final response = await _dio.post(
      EventEndpoints.joinAsVolunteer(eventId),
      data: {'code': code},
    );
    return CampusEvent.fromJson(response.data['event'] as Map<String, dynamic>);
  }

  Future<CheckInResult> checkIn(String eventId, String qrPayload) async {
    try {
      final response = await _dio.post(
        EventEndpoints.checkIn(eventId),
        data: {'qrPayload': qrPayload},
      );
      return _checkInResult(CheckInOutcome.allowed, response.data);
    } on DioException catch (e) {
      final data = e.response?.data;
      if (e.response?.statusCode == 409 && data is Map<String, dynamic>) {
        return _checkInResult(CheckInOutcome.alreadyEntered, data);
      }
      return CheckInResult(
        outcome: CheckInOutcome.denied,
        message: userFacingApiError(e, fallback: 'Could not verify this QR'),
      );
    }
  }

  Future<({int approved, int checkedIn})> checkInStats(String eventId) async {
    final response = await _dio.get(EventEndpoints.checkInStats(eventId));
    return (
      approved: (response.data['approved'] as num?)?.toInt() ?? 0,
      checkedIn: (response.data['checkedIn'] as num?)?.toInt() ?? 0,
    );
  }

  CheckInResult _checkInResult(CheckInOutcome outcome, dynamic data) {
    final map = data is Map<String, dynamic> ? data : <String, dynamic>{};
    final attendee = map['attendee'];
    return CheckInResult(
      outcome: outcome,
      message: map['message']?.toString() ?? '',
      attendee: attendee is Map<String, dynamic>
          ? EventAttendee.fromJson(attendee)
          : null,
      checkedInAt: _parseDate(map['checkedInAt']),
    );
  }
}
