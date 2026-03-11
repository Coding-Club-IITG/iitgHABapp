import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../constants/endpoint.dart';

class ManagerApi {
  ManagerApi._();

  /// Shared Dio client with verbose logging to help debug real-device issues.
  static final Dio _dio = (Dio()
        ..options.validateStatus = (code) => code != null && code < 500)
      ..interceptors.add(
      LogInterceptor(
        request: true,
        requestBody: true,
        responseBody: true,
        responseHeader: false,
        error: true,
        logPrint: (obj) => debugPrint('[DIO] $obj'),
      ),
    );

  static Map<String, String> _authHeaders(String token) => {
        'Authorization': 'Bearer $token',
      };

  static Future<List<String>> fetchHostels() async {
    debugPrint(
        '[ManagerApi] Fetching hostels from ${HostelEndpoints.allHostels} ...');
    try {
      final response = await _dio.get(HostelEndpoints.allHostels);
      debugPrint(
          '[ManagerApi] /hostel/all -> status=${response.statusCode}, dataType=${response.data.runtimeType}');
      final data = response.data as List<dynamic>;
      final hostels = data
          .map((raw) => (raw as Map<String, dynamic>)['hostel_name'] as String)
          .toList();
      debugPrint('[ManagerApi] Parsed ${hostels.length} hostels: $hostels');
      return hostels;
    } catch (e, st) {
      debugPrint('[ManagerApi] fetchHostels error: $e');
      debugPrint('[ManagerApi] fetchHostels stack: $st');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> loginManager({
    required String hostelName,
    required String password,
  }) async {
    debugPrint(
        '[ManagerApi] Login manager: hostel=$hostelName url=${AuthEndpoints.managerLogin}');
    final response = await _dio.post(
      AuthEndpoints.managerLogin,
      data: {
        'hostelName': hostelName,
        'password': password,
      },
    );
    debugPrint(
        '[ManagerApi] /auth/manager/login -> status=${response.statusCode}, data=${response.data}');
    return response.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> fetchTodayMessSummary(
    String token,
  ) async {
    final response = await _dio.get(
      MessManagerEndpoints.todaySummary,
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> fetchGalaSummary(String token) async {
    final response = await _dio.get(
      GalaManagerEndpoints.summary,
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<bool> hasTodayGala(String token) async {
    final data = await fetchGalaSummary(token);
    return data['galaDinner'] != null;
  }

  static Future<Map<String, dynamic>> fetchUserProfileForManager({
    required String token,
    required String userId,
  }) async {
    final response = await _dio.get(
      MessManagerEndpoints.userProfile(userId),
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<Uint8List?> fetchUserProfilePictureForManager({
    required String token,
    required String userId,
  }) async {
    final response = await _dio.get<List<int>>(
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

  /// GET tomorrow's room-cleaning bookings for the manager's hostel.
  /// Returns { bookings: [ { _id, roomNumber, slot, timeRange, assignedTo } ], totalCleaners }.
  static Future<Map<String, dynamic>> fetchRcTomorrow(
    String token, [
    String? date,
  ]) async {
    final uri = date != null
        ? Uri.parse(RcEndpoints.tomorrow).replace(queryParameters: {'date': date})
        : Uri.parse(RcEndpoints.tomorrow);
    final response = await _dio.get(
      uri.toString(),
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  /// POST room-cleaning assignments for tomorrow.
  /// Body: { date?: 'YYYY-MM-DD', assignments: [ { bookingId, assignedTo } ] }.
  static Future<Map<String, dynamic>> postRcTomorrowAssign(
    String token, {
    String? date,
    required List<Map<String, dynamic>> assignments,
  }) async {
    final body = <String, dynamic>{
      'assignments': assignments,
    };
    if (date != null) body['date'] = date;
    final response = await _dio.post(
      RcEndpoints.tomorrowAssign,
      data: body,
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  /// POST to finalize booking statuses for a given date (e.g. Yesterday).
  /// Body: { date: 'YYYY-MM-DD', updates: [ { bookingId, status, reason? } ] }.
  static Future<Map<String, dynamic>> postRcFinalizeStatuses(
    String token, {
    required String date,
    required List<Map<String, dynamic>> updates,
  }) async {
    final body = <String, dynamic>{
      'date': date,
      'updates': updates,
    };
    final response = await _dio.post(
      RcEndpoints.finalizeStatuses,
      data: body,
      options: Options(headers: _authHeaders(token)),
    );
    if (response.statusCode == 200) {
      return response.data as Map<String, dynamic>;
    }

    final data = response.data;
    final serverMessage = data is Map && data['message'] != null
        ? data['message'].toString()
        : data?.toString();
    throw Exception(
      'Finalize failed (status ${response.statusCode}). '
      '${serverMessage ?? 'If you just added the endpoint, restart the backend server.'}',
    );
  }
}

