import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../constants/endpoint.dart';

class LeaveApi {
  LeaveApi._();

  static final Dio _dio = Dio()
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

  static Future<List<dynamic>> fetchPendingApplications(String token) async {
    try {
      final response = await _dio.get(
        LeaveEndpoints.pendingApplications,
        options: Options(headers: _authHeaders(token)),
      );
      return response.data['pendingApplications'] as List<dynamic>;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return [];
      }
      rethrow;
    }
  }

  static Future<List<dynamic>> filterApplications({
    required String token,
    String? status,
    int? month,
    int? year,
  }) async {
    try {
      final Map<String, dynamic> queryParams = {};
      if (status != null) queryParams['status'] = status;
      if (month != null) queryParams['month'] = month;
      if (year != null) queryParams['year'] = year;

      final response = await _dio.get(
        LeaveEndpoints.allApplications,
        queryParameters: queryParams,
        options: Options(headers: _authHeaders(token)),
      );
      return response.data['filteredApplications'] as List<dynamic>;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return [];
      }
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> approveApplication({
    required String token,
    required String applicationId,
    String? feedback,
  }) async {
    final response = await _dio.post(
      LeaveEndpoints.approveApplication(applicationId),
      data: feedback != null ? {'feedback': feedback} : {},
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> rejectApplication({
    required String token,
    required String applicationId,
    String? feedback,
  }) async {
    final response = await _dio.post(
      LeaveEndpoints.rejectApplication(applicationId),
      data: feedback != null ? {'feedback': feedback} : {},
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> fetchRebateSummary({
    required String token,
    required int month,
    required int year,
  }) async {
    final response = await _dio.get(
      LeaveEndpoints.rebateSummary,
      queryParameters: {
        'month': month,
        'year': year,
      },
      options: Options(headers: _authHeaders(token)),
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<File> downloadProofDocument({
    required String token,
    required String documentUrl,
  }) async {
    try {
      // 1. Get the device's temporary directory
      final tempDir = await getTemporaryDirectory();
      
      // 2. Generate a unique file name so we don't overwrite previous views
      final fileName = 'leave_proof_${DateTime.now().millisecondsSinceEpoch}.pdf';
      final savePath = '${tempDir.path}/$fileName';

      // 3. Make the POST request requesting bytes
      final response = await _dio.post(
        LeaveEndpoints.downloadDocument,
        data: {'proofDocumentUrl': documentUrl},
        options: Options(
          headers: _authHeaders(token),
          responseType: ResponseType.bytes, // CRITICAL: Tells Dio to expect a file, not JSON
        ),
      );

      // 4. Save the bytes to the file system
      final file = File(savePath);
      await file.writeAsBytes(response.data);
      
      return file;
    } catch (e) {
      rethrow;
    }
  }
}