import 'package:dio/dio.dart';

/// Prefer [reason], then [message], from JSON error bodies returned by the API.
String? messageFromApiErrorBody(dynamic data) {
  if (data is! Map) return null;
  final reason = data['reason'];
  if (reason is String && reason.trim().isNotEmpty) return reason.trim();
  final message = data['message'];
  if (message is String && message.trim().isNotEmpty) return message.trim();
  return null;
}

/// User-facing text from a failed API call (Dio), or [fallback].
String userFacingApiError(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (error is DioException) {
    final fromBody = messageFromApiErrorBody(error.response?.data);
    if (fromBody != null) return fromBody;
  }
  return fallback;
}
