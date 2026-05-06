import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../constants/endpoint.dart';
import 'manager_dio.dart';

class ManagerApi {
  ManagerApi._();

  static String? _contentType(Response r) =>
      r.headers.value('content-type')?.trim();

  static String? _normalizeMime(String? ct) {
    if (ct == null || ct.isEmpty) return null;
    return ct.split(';').first.trim().toLowerCase();
  }

  static String extFromContentType(String? contentType) {
    final ct = _normalizeMime(contentType);
    switch (ct) {
      case 'application/pdf':
        return 'pdf';
      case 'image/png':
        return 'png';
      case 'image/jpg':
      case 'image/jpeg':
        return 'jpg';
      default:
        return 'bin';
    }
  }

  static Map<String, String> _authHeaders(String token) => {
    'Authorization': 'Bearer $token',
  };

  static Future<List<String>> fetchHostels() async {
    if (kDebugMode) {
      debugPrint(
        '[ManagerApi] Fetching hostels from ${HostelEndpoints.allHostels} ...',
      );
    }
    try {
      final response = await ManagerDio.dio.get(HostelEndpoints.allHostels);
      if (kDebugMode) {
        debugPrint(
          '[ManagerApi] /hostel/all -> status=${response.statusCode}, dataType=${response.data.runtimeType}',
        );
      }
      final data = response.data as List<dynamic>;
      final hostels = data
          .map((raw) => (raw as Map<String, dynamic>)['hostel_name'] as String)
          .toList();
      if (kDebugMode) {
        debugPrint('[ManagerApi] Parsed ${hostels.length} hostels: $hostels');
      }
      return hostels;
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('[ManagerApi] fetchHostels error: $e');
        debugPrint('[ManagerApi] fetchHostels stack: $st');
      }
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> loginManager({
    required String hostelName,
    required String password,
  }) async {
    if (kDebugMode) {
      debugPrint(
        '[ManagerApi] Login manager: hostel=$hostelName url=${AuthEndpoints.managerLogin}',
      );
    }
    final response = await ManagerDio.dio.post(
      AuthEndpoints.managerLogin,
      data: {'hostelName': hostelName, 'password': password},
    );
    if (kDebugMode) {
      debugPrint(
        '[ManagerApi] /auth/manager/login -> status=${response.statusCode}, data=${response.data}',
      );
    }
    return response.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> fetchTodayMessSummary(
    String token,
  ) async {
    final response = await ManagerDio.dio.get(
      MessManagerEndpoints.todaySummary,
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  /// HABit HQ: manually add a scan log for the ongoing meal (backend decides meal by time window).
  static Future<Map<String, dynamic>> addOngoingMealScan({
    required String token,
    required String rollNumber,
  }) async {
    final response = await ManagerDio.dio.post(
      MessManagerEndpoints.addOngoingScan,
      data: {'rollNumber': rollNumber},
      options: Options(headers: _authHeaders(token)),
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  static Future<Map<String, dynamic>> fetchGalaSummary(String token) async {
    final response = await ManagerDio.dio.get(
      GalaManagerEndpoints.summary,
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<bool> hasTodayGala(String token) async {
    final data = await fetchGalaSummary(token);
    return data['galaDinner'] != null;
  }

  static Future<List<Map<String, dynamic>>> fetchMessRebateApplications({
    required String token,
    int? month,
    int? year,
    String? status,
  }) async {
    final query = <String, dynamic>{};
    if (month != null) query['month'] = month;
    if (year != null) query['year'] = year;
    if (status != null && status.trim().isNotEmpty) query['status'] = status;

    final response = await ManagerDio.dio.get(
      MessRebateManagerEndpoints.messApplications,
      queryParameters: query.isEmpty ? null : query,
      options: Options(headers: _authHeaders(token)),
    );

    final data = response.data;
    if (data is Map && data['applications'] is List) {
      return (data['applications'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }

  static Future<Map<String, dynamic>> acknowledgeMessRebateApplication({
    required String token,
    required String applicationId,
  }) async {
    final response = await ManagerDio.dio.post(
      MessRebateManagerEndpoints.acknowledge(applicationId),
      options: Options(headers: _authHeaders(token)),
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  static Future<
    ({
      List<Map<String, dynamic>> applications,
      String seasonKey,
      String seasonLabel,
    })
  >
  fetchSummerMessApplications({
    required String token,
    String status = 'Pending',
    String? seasonKey,
  }) async {
    final response = await ManagerDio.dio.get(
      SummerMessManagerEndpoints.applications,
      queryParameters: <String, dynamic>{
        'status': status,
        if (seasonKey != null && seasonKey.trim().isNotEmpty)
          'seasonKey': seasonKey.trim(),
      },
      options: Options(headers: _authHeaders(token)),
    );

    final data = response.data;
    if (data is Map && data['applications'] is List) {
      return (
        applications: (data['applications'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(),
        seasonKey: (data['seasonKey'] ?? '').toString(),
        seasonLabel: (data['seasonLabel'] ?? '').toString(),
      );
    }
    return (
      applications: const <Map<String, dynamic>>[],
      seasonKey: '',
      seasonLabel: '',
    );
  }

  static Future<Map<String, dynamic>> acknowledgeSummerMessApplication({
    required String token,
    required String applicationId,
  }) async {
    final response = await ManagerDio.dio.post(
      SummerMessManagerEndpoints.acknowledge(applicationId),
      options: Options(headers: _authHeaders(token)),
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  static Future<({Uint8List bytes, String? contentType})>
  downloadSummerMessProof({
    required String token,
    required String applicationId,
  }) async {
    final response = await ManagerDio.dio.get<List<int>>(
      SummerMessManagerEndpoints.proofDocument(applicationId),
      options: Options(
        headers: _authHeaders(token),
        responseType: ResponseType.bytes,
        validateStatus: (code) => code != null && code >= 200 && code < 400,
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw Exception('Empty download response');
    }
    return (
      bytes: Uint8List.fromList(bytes),
      contentType: _contentType(response),
    );
  }

  /// Download a proof/leave document via authenticated backend endpoint.
  /// The backend streams OneDrive bytes so the client doesn't hit 401/403.
  static Future<({Uint8List bytes, String? contentType})>
  downloadLeaveDocument({
    required String token,
    required String documentUrl,
  }) async {
    final response = await ManagerDio.dio.post<List<int>>(
      MessRebateManagerEndpoints.download,
      data: {'proofDocumentUrl': documentUrl},
      options: Options(
        headers: _authHeaders(token),
        responseType: ResponseType.bytes,
        validateStatus: (code) => code != null && code >= 200 && code < 400,
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw Exception('Empty download response');
    }
    return (
      bytes: Uint8List.fromList(bytes),
      contentType: _contentType(response),
    );
  }

  static Future<Map<String, dynamic>> fetchUserProfileForManager({
    required String token,
    required String userId,
  }) async {
    final response = await ManagerDio.dio.get(
      MessManagerEndpoints.userProfile(userId),
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<Uint8List?> fetchUserProfilePictureForManager({
    required String token,
    required String userId,
  }) async {
    final response = await ManagerDio.dio.get<List<int>>(
      MessManagerEndpoints.userProfilePicture(userId),
      options: Options(
        headers: _authHeaders(token),
        responseType: ResponseType.bytes,
        validateStatus: (code) => code != null && code < 500,
      ),
    );

    if (response.statusCode == 200) {
      // If server returned JSON instead of bytes, skip.
      final contentType = response.headers.value('content-type') ?? '';
      if (contentType.contains('application/json')) {
        return null;
      }
      final data = response.data;
      if (data == null) return null;
      return Uint8List.fromList(data);
    }

    // 404 or 403 etc. → treat as no picture.
    return null;
  }

  static Future<Map<String, dynamic>> fetchManagerSubscribers({
    required String token,
    String? query,
    int page = 1,
    int limit = 200,
  }) async {
    final response = await ManagerDio.dio.get(
      ManagerUserEndpoints.subscribers,
      queryParameters: <String, dynamic>{
        if (query != null && query.trim().isNotEmpty) 'q': query.trim(),
        'page': page,
        'limit': limit,
      },
      options: Options(headers: _authHeaders(token)),
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  static Future<Map<String, dynamic>> fetchSubscriberTodayStatus({
    required String token,
    required String userId,
  }) async {
    final response = await ManagerDio.dio.get(
      ManagerUserEndpoints.subscriberTodayStatus(userId),
      options: Options(headers: _authHeaders(token)),
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  static Future<Map<String, dynamic>> createScanEntry({
    required String token,
    required String userId,
    required String mealType,
    String? date,
  }) async {
    final response = await ManagerDio.dio.post(
      MessManagerEndpoints.createScanEntry,
      data: <String, dynamic>{
        'userId': userId,
        'mealType': mealType,
        if (date != null && date.trim().isNotEmpty) 'date': date.trim(),
      },
      options: Options(headers: _authHeaders(token)),
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }
}
