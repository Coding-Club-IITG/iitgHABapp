import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../constants/endpoint.dart';
import '../providers/auth_controller.dart';

/// Caterer Google login + refresh (plain [Dio] for refresh — not [ManagerDio.dio]).
class CatererAuthApi {
  CatererAuthApi._();

  static final Dio _plain = Dio();

  /// Returns true if access + refresh were applied to [auth].
  static Future<bool> tryRefresh(AuthController auth) async {
    final refresh = await auth.readRefreshToken();
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final res = await _plain.post<Map<String, dynamic>>(
        AuthEndpoints.catererRefresh,
        data: <String, dynamic>{'refreshToken': refresh},
        options: Options(validateStatus: (c) => c != null && c < 500),
      );
      final data = res.data;
      if (res.statusCode == 200 &&
          data != null &&
          data['success'] == true &&
          data['token'] != null) {
        final access = data['token']!.toString();
        final newRefresh = data['refreshToken']?.toString() ?? refresh;
        await auth.applyRefreshedTokens(access: access, refresh: newRefresh);
        return true;
      }
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('[CatererAuthApi] tryRefresh failed: $e');
        debugPrint('$st');
      }
    }
    return false;
  }

  /// Google ID token → caterer session. Returns server JSON or throws [DioException].
  static Future<Map<String, dynamic>> loginWithGoogleIdToken(
    String idToken,
  ) async {
    if (kDebugMode) {
      debugPrint(
        '[CatererAuthApi] POST ${AuthEndpoints.catererGoogle} (idTokenLen=${idToken.length})',
      );
    }
    final res = await _plain.post<Map<String, dynamic>>(
      AuthEndpoints.catererGoogle,
      data: <String, dynamic>{'idToken': idToken},
      options: Options(validateStatus: (c) => c != null && c < 500),
    );
    if (kDebugMode) {
      debugPrint(
        '[CatererAuthApi] response status=${res.statusCode} dataType=${res.data.runtimeType}',
      );
    }
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        message: 'Empty response',
      );
    }
    return data;
  }

  /// Guest login → caterer session for Lohit hostel. Returns server JSON or throws [DioException].
  static Future<Map<String, dynamic>> guestAuthenticate() async {
    if (kDebugMode) {
      debugPrint('[CatererAuthApi] POST ${AuthEndpoints.catererGuest}');
    }
    final res = await _plain.post<Map<String, dynamic>>(
      AuthEndpoints.catererGuest,
      data: <String, dynamic>{},
      options: Options(validateStatus: (c) => c != null && c < 500),
    );
    if (kDebugMode) {
      debugPrint(
        '[CatererAuthApi] response status=${res.statusCode} dataType=${res.data.runtimeType}',
      );
    }
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        message: 'Empty response',
      );
    }
    return data;
  }

  static Future<void> logoutRefresh(String refreshToken) async {
    try {
      await _plain.post(
        AuthEndpoints.catererLogout,
        data: <String, dynamic>{'refreshToken': refreshToken},
      );
    } catch (_) {
      // best-effort
    }
  }
}
