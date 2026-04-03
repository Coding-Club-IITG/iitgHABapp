import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/screens/login_screen.dart';
import 'package:frontend2/utilities/version_checker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/apis/authentication/login.dart'; // for refreshAccessToken
import 'package:frontend2/main.dart'; // for navigatorKey

class DioClient {
  static final DioClient _instance = DioClient._internal();
  late final Dio _dio;

  factory DioClient() {
    return _instance;
  }

  DioClient._internal() {
    _dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
    ));

    // ADD INTERCEPTOR
    _dio.interceptors.add(InterceptorsWrapper(
      // =======================
      // REQUEST INTERCEPTOR
      // =======================
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('access_token');

        // Attach access token
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }

        // Add version headers
        final apiHeaders = VersionChecker.getApiHeaders();
        apiHeaders.forEach((key, value) {
          if (key.toLowerCase() != 'content-type' ||
              !options.headers.containsKey('content-type')) {
            options.headers[key] = value;
          }
        });

        if (kDebugMode) {
          debugPrint("Request: ${options.uri}");
        }

        return handler.next(options);
      },

      // =======================
      // ERROR INTERCEPTOR
      // =======================
      onError: (error, handler) async {
        // 🔥 Only handle 401 (access token expired)
        if (error.response?.statusCode == 401 &&
            !error.requestOptions.path.contains('/auth/refresh')) {
          if (kDebugMode) {
            debugPrint("401 detected → trying refresh");
            debugPrint(
                "[DioClient] Attempting refresh for request: ${error.requestOptions.uri}");
          }

          final success = await refreshAccessToken();

          debugPrint("Refresh success: $success");

          if (success) {
            final prefs = await SharedPreferences.getInstance();
            final newAccess = prefs.getString('access_token');

            if (newAccess != null) {
              // 🔁 Retry original request
              final requestOptions = error.requestOptions;

              requestOptions.headers['Authorization'] = 'Bearer $newAccess';

              try {
                final response = await _dio.fetch(requestOptions);
                return handler.resolve(response);
              } catch (e) {
                return handler.reject(error);
              }
            }
          }

          // Refresh failed → logout user
          if (kDebugMode) {
            debugPrint("Refresh failed → logging out");
          }

          final prefs = await SharedPreferences.getInstance();
          await prefs.clear();

          // TODO: LOGIN SCREEN IS NOT SHOWING UP AFTER LOGOUT - FIX THIS

          WidgetsBinding.instance.addPostFrameCallback((_) {
            navigatorKey.currentState?.pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
              (route) => false,
            );
          });
          return handler.reject(error);
        }

        return handler.next(error);
      },
    ));
  }

  Dio get dio => _dio;
}
