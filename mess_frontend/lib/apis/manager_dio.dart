import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../providers/auth_controller.dart';
import 'caterer_auth_api.dart';

/// Shared Dio for HABit HQ with 401 → caterer refresh → retry (when refresh token exists).
class ManagerDio {
  ManagerDio._();

  static AuthController? _auth;

  /// Call once after creating [AuthController] (e.g. from `main.dart`).
  static void configure(AuthController auth) {
    _auth = auth;
  }

  static final Dio dio = () {
    final d = Dio();
    if (kDebugMode) {
      d.interceptors.add(
        LogInterceptor(
          request: true,
          requestBody: true,
          responseBody: true,
          responseHeader: false,
          error: true,
          logPrint: (obj) => debugPrint('[DIO] $obj'),
        ),
      );
    }
    d.interceptors.add(
      InterceptorsWrapper(
        onError: (err, handler) async {
          if (err.response?.statusCode != 401) {
            return handler.next(err);
          }
          final req = err.requestOptions;
          if (req.uri.path.contains('/auth/caterer/refresh')) {
            return handler.next(err);
          }
          final authHeader = _authorizationHeader(req);
          if (authHeader == null ||
              !authHeader.toLowerCase().startsWith('bearer ')) {
            return handler.next(err);
          }

          final auth = _auth;
          if (auth == null) {
            return handler.next(err);
          }

          final refreshed = await CatererAuthApi.tryRefresh(auth);
          if (!refreshed) {
            await auth.signOut();
            return handler.next(err);
          }

          final newAccess = auth.token;
          if (newAccess == null || newAccess.isEmpty) {
            await auth.signOut();
            return handler.next(err);
          }

          req.headers['Authorization'] = 'Bearer $newAccess';
          try {
            final response = await d.fetch(req);
            return handler.resolve(response);
          } catch (e) {
            return handler.next(err);
          }
        },
      ),
    );
    return d;
  }();
}

String? _authorizationHeader(RequestOptions o) {
  final h = o.headers;
  final a = h['Authorization'] ?? h['authorization'];
  if (a == null) return null;
  if (a is String) return a;
  if (a is List && a.isNotEmpty) return a.first as String?;
  return null;
}
