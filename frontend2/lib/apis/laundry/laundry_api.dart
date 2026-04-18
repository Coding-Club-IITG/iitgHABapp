import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/apis/dio_client.dart';

class LaundryStatus {
  final bool canUse;
  final DateTime? lastUsed;
  final DateTime? nextAvailable;
  final bool hostelHasLaundry;
  final String? message;
  final List<LaundryBookingSummary> recentBookings;

  LaundryStatus({
    required this.canUse,
    this.lastUsed,
    this.nextAvailable,
    required this.hostelHasLaundry,
    this.message,
    required this.recentBookings,
  });

  factory LaundryStatus.fromJson(Map<String, dynamic> json) {
    final list = (json['recentBookings'] as List<dynamic>? ?? []);
    return LaundryStatus(
      canUse: json['canUse'] == true,
      lastUsed: json['lastUsed'] != null
          ? DateTime.tryParse(json['lastUsed'] as String)
          : null,
      nextAvailable: json['nextAvailable'] != null
          ? DateTime.tryParse(json['nextAvailable'] as String)
          : null,
      hostelHasLaundry: json['hostelHasLaundry'] == true,
      message: json['message'] as String?,
      recentBookings: list
          .map((e) => LaundryBookingSummary.fromJson(
                e as Map<String, dynamic>,
              ))
          .toList(),
    );
  }
}

class LaundryBookingSummary {
  final String id;
  final DateTime usedAt;

  LaundryBookingSummary({required this.id, required this.usedAt});

  factory LaundryBookingSummary.fromJson(Map<String, dynamic> json) {
    return LaundryBookingSummary(
      id: json['_id']?.toString() ?? '',
      usedAt: DateTime.parse(json['usedAt'] as String),
    );
  }
}

class LaundryScanResult {
  final String message;
  final String? bookingId;
  final DateTime? usedAt;

  LaundryScanResult({
    required this.message,
    this.bookingId,
    this.usedAt,
  });

  factory LaundryScanResult.fromJson(Map<String, dynamic> json) {
    return LaundryScanResult(
      message: json['message']?.toString() ?? 'Success',
      bookingId: json['booking']?['_id']?.toString(),
      usedAt: json['booking']?['usedAt'] != null
          ? DateTime.tryParse(json['booking']['usedAt'] as String)
          : null,
    );
  }
}

class LaundryApi {
  Future<String?> _getToken() async {
    return getAccessToken();
  }

  Future<LaundryStatus> getStatus() async {
    final token = await _getToken();
    if (token == 'error') throw Exception('Not authenticated');

    final dio = DioClient().dio;
    final response = await dio.get(
      LaundryEndpoints.status,
      options: Options(headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      }),
    );
    if (response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      final data = response.data as Map<String, dynamic>;
      return LaundryStatus.fromJson(data);
    } else {
      final body = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : <String, dynamic>{};
      final msg =
          body['message']?.toString() ?? 'Failed to fetch laundry status';
      throw Exception(msg);
    }
  }

  Future<LaundryScanResult> scan(
      {String? hostelId, String? scannedPayload}) async {
    final token = await _getToken();
    if (token == 'error') throw Exception('Not authenticated');

    final body = <String, dynamic>{};
    if (hostelId != null && hostelId.isNotEmpty) body['hostelId'] = hostelId;
    if (scannedPayload != null && scannedPayload.isNotEmpty) {
      body['scannedPayload'] = scannedPayload;
    }

    final dio = DioClient().dio;
    final response = await dio.post(
      LaundryEndpoints.scan,
      data: body,
      options: Options(headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      }),
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : <String, dynamic>{};
    if (response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      return LaundryScanResult.fromJson(data);
    } else {
      final msg =
          data['message']?.toString() ?? 'Failed to avail laundry service';
      throw Exception(msg);
    }
  }
}
