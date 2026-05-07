import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';

class SummerMessHostelOption {
  const SummerMessHostelOption({
    required this.id,
    required this.hostelName,
  });

  final String id;
  final String hostelName;

  factory SummerMessHostelOption.fromJson(Map<String, dynamic> json) {
    return SummerMessHostelOption(
      id: json['_id']?.toString() ?? '',
      hostelName: (json['hostel_name'] ?? '').toString(),
    );
  }
}

class SummerMessApplicationData {
  const SummerMessApplicationData({
    required this.id,
    required this.status,
    required this.appliedHostelId,
    required this.appliedHostelName,
    required this.paymentProofUploaded,
    required this.paymentProofFilename,
    required this.canCancel,
    required this.totalDays,
    required this.totalAmount,
    required this.paymentProofUrl,
    this.appliedAt,
    this.acknowledgedAt,
    this.messChangedAt,
  });

  final String id;
  final String status;
  final String appliedHostelId;
  final String appliedHostelName;
  final bool paymentProofUploaded;
  final String paymentProofFilename;
  final bool canCancel;
  final int totalDays;
  final double totalAmount;
  final String paymentProofUrl;
  final DateTime? appliedAt;
  final DateTime? acknowledgedAt;
  final DateTime? messChangedAt;

  bool get isPending => status.toLowerCase() == 'pending';
  bool get isAcknowledged => status.toLowerCase() == 'acknowledged';

  factory SummerMessApplicationData.fromJson(Map<String, dynamic> json) {
    final appliedHostel = (json['appliedHostel'] is Map<String, dynamic>)
        ? json['appliedHostel'] as Map<String, dynamic>
        : (json['appliedHostel'] is Map)
            ? Map<String, dynamic>.from(json['appliedHostel'] as Map)
            : const <String, dynamic>{};

    DateTime? parseDate(dynamic value) {
      if (value == null) return null;
      final parsed = DateTime.tryParse(value.toString());
      return parsed;
    }

    return SummerMessApplicationData(
      id: json['_id']?.toString() ?? '',
      status: (json['status'] ?? '').toString(),
      appliedHostelId: appliedHostel['_id']?.toString() ?? '',
      appliedHostelName: (appliedHostel['hostel_name'] ?? '').toString(),
      paymentProofUploaded: json['paymentProofUploaded'] == true,
      paymentProofFilename: (json['paymentProofFilename'] ?? '').toString(),
      canCancel: json['canCancel'] == true,
      totalDays: (json['totalDays'] as num?)?.toInt() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      paymentProofUrl: (json['paymentProofUrl'] ?? '').toString(),
      appliedAt: parseDate(json['appliedAt']),
      acknowledgedAt: parseDate(json['acknowledgedAt']),
      messChangedAt: parseDate(json['messChangedAt']),
    );
  }
}

class SummerMessPricingData {
  const SummerMessPricingData({
    required this.ratePerDay,
    required this.totalDays,
    required this.totalAmount,
  });

  final double ratePerDay;
  final int totalDays;
  final double totalAmount;

  factory SummerMessPricingData.fromJson(Map<String, dynamic> json) {
    return SummerMessPricingData(
      ratePerDay: (json['ratePerDay'] as num?)?.toDouble() ?? 0,
      totalDays: (json['totalDays'] as num?)?.toInt() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
    );
  }
}

class SummerMessStudentProfileData {
  const SummerMessStudentProfileData({
    required this.name,
    required this.rollNumber,
    required this.email,
  });

  final String name;
  final String rollNumber;
  final String email;

  factory SummerMessStudentProfileData.fromJson(Map<String, dynamic> json) {
    return SummerMessStudentProfileData(
      name: (json['name'] ?? '').toString(),
      rollNumber: (json['rollNumber'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
    );
  }
}

class SummerMessStatusData {
  const SummerMessStatusData({
    required this.seasonKey,
    required this.seasonLabel,
    required this.shouldShowCard,
    required this.canApply,
    required this.registrationOpen,
    required this.summerActive,
    required this.availableHostels,
    required this.application,
    required this.studentProfile,
    required this.pricing,
    required this.boardingHostelName,
    required this.currentSubscriptionName,
    required this.activeSeasonLabel,
    this.registrationStartAt,
    this.registrationEndAt,
    this.summerStartAt,
    this.summerEndAt,
  });

  final String seasonKey;
  final String seasonLabel;
  final bool shouldShowCard;
  final bool canApply;
  final bool registrationOpen;
  final bool summerActive;
  final DateTime? registrationStartAt;
  final DateTime? registrationEndAt;
  final DateTime? summerStartAt;
  final DateTime? summerEndAt;
  final List<SummerMessHostelOption> availableHostels;
  final SummerMessApplicationData? application;
  final SummerMessStudentProfileData studentProfile;
  final SummerMessPricingData pricing;
  final String boardingHostelName;
  final String currentSubscriptionName;
  final String activeSeasonLabel;

  bool get hasApplication => application != null;
  bool get isAcknowledged => application?.isAcknowledged == true;
  bool get isPending => application?.isPending == true;

  factory SummerMessStatusData.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) {
      if (value == null) return null;
      return DateTime.tryParse(value.toString());
    }

    final registration = (json['registration'] is Map<String, dynamic>)
        ? json['registration'] as Map<String, dynamic>
        : (json['registration'] is Map)
            ? Map<String, dynamic>.from(json['registration'] as Map)
            : const <String, dynamic>{};
    final summer = (json['summer'] is Map<String, dynamic>)
        ? json['summer'] as Map<String, dynamic>
        : (json['summer'] is Map)
            ? Map<String, dynamic>.from(json['summer'] as Map)
            : const <String, dynamic>{};
    final boardingHostel = (json['boardingHostel'] is Map<String, dynamic>)
        ? json['boardingHostel'] as Map<String, dynamic>
        : (json['boardingHostel'] is Map)
            ? Map<String, dynamic>.from(json['boardingHostel'] as Map)
            : const <String, dynamic>{};
    final currentSubscription =
        (json['currentSubscription'] is Map<String, dynamic>)
            ? json['currentSubscription'] as Map<String, dynamic>
            : (json['currentSubscription'] is Map)
                ? Map<String, dynamic>.from(json['currentSubscription'] as Map)
                : const <String, dynamic>{};
    final activeSeason = (json['activeSeason'] is Map<String, dynamic>)
        ? json['activeSeason'] as Map<String, dynamic>
        : (json['activeSeason'] is Map)
            ? Map<String, dynamic>.from(json['activeSeason'] as Map)
            : const <String, dynamic>{};
    final pricing = (json['pricing'] is Map<String, dynamic>)
        ? json['pricing'] as Map<String, dynamic>
        : (json['pricing'] is Map)
            ? Map<String, dynamic>.from(json['pricing'] as Map)
            : const <String, dynamic>{};
    final studentProfile = (json['studentProfile'] is Map<String, dynamic>)
        ? json['studentProfile'] as Map<String, dynamic>
        : (json['studentProfile'] is Map)
            ? Map<String, dynamic>.from(json['studentProfile'] as Map)
            : const <String, dynamic>{};

    final hostelsRaw = (json['availableHostels'] as List?)
            ?.whereType<Map>()
            .map((raw) => SummerMessHostelOption.fromJson(
                  Map<String, dynamic>.from(raw),
                ))
            .toList() ??
        const <SummerMessHostelOption>[];

    final application = json['application'] is Map
        ? SummerMessApplicationData.fromJson(
            Map<String, dynamic>.from(json['application'] as Map),
          )
        : null;

    return SummerMessStatusData(
      seasonKey: (json['seasonKey'] ?? '').toString(),
      seasonLabel: (json['seasonLabel'] ?? '').toString(),
      shouldShowCard: json['shouldShowCard'] == true,
      canApply: json['canApply'] == true,
      registrationStartAt: parseDate(registration['startAt']),
      registrationOpen: registration['isOpen'] == true,
      summerActive: summer['isActive'] == true,
      summerStartAt: parseDate(summer['startAt']),
      registrationEndAt: parseDate(registration['endAt']),
      summerEndAt: parseDate(summer['endAt']),
      availableHostels: hostelsRaw,
      application: application,
      studentProfile: SummerMessStudentProfileData.fromJson(studentProfile),
      pricing: SummerMessPricingData.fromJson(pricing),
      boardingHostelName: (boardingHostel['hostel_name'] ?? '').toString(),
      currentSubscriptionName:
          (currentSubscription['hostel_name'] ?? '').toString(),
      activeSeasonLabel: (activeSeason['seasonLabel'] ?? '').toString(),
    );
  }
}

Future<SummerMessStatusData> fetchSummerMessStatus() async {
  final token = await getAccessToken();
  final response = await DioClient().dio.get(
        SummerMessEndpoints.status,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        ),
      );

  final data = response.data is Map<String, dynamic>
      ? response.data as Map<String, dynamic>
      : Map<String, dynamic>.from(response.data as Map);
  return SummerMessStatusData.fromJson(data);
}

Future<void> submitSummerMessRegistration({
  required String hostelId,
  required bool registrationTermsAccepted,
  required bool paymentProofDeclarationAccepted,
  required PlatformFile paymentProof,
}) async {
  final token = await getAccessToken();
  final path = paymentProof.path;
  if (path == null || path.isEmpty) {
    throw Exception('Selected payment proof is not readable.');
  }
  final formData = FormData.fromMap({
    'hostelId': hostelId,
    'registrationTermsAccepted': registrationTermsAccepted ? 'true' : 'false',
    'paymentProofDeclarationAccepted':
        paymentProofDeclarationAccepted ? 'true' : 'false',
    'paymentProof': await MultipartFile.fromFile(
      path,
      filename: paymentProof.name,
    ),
  });
  await DioClient().dio.post(
        SummerMessEndpoints.register,
        data: formData,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );
}

Future<void> cancelSummerMessApplication({
  required String applicationId,
}) async {
  final token = await getAccessToken();
  await DioClient().dio.delete(
        SummerMessEndpoints.cancelApplication(applicationId),
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        ),
      );
}

Future<void> deleteSummerSubscription() async {
  final token = await getAccessToken();
  await DioClient().dio.post(
    SummerMessEndpoints.unsubscribe,
    options: Options(
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    ),
  );
}

String summerMessApiErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
    if (error.message != null && error.message!.trim().isNotEmpty) {
      return error.message!;
    }
  }
  if (kDebugMode) {
    debugPrint('summerMessApiErrorMessage: $error');
  }
  return 'Something went wrong. Please try again.';
}
