import 'package:flutter/foundation.dart';

/// Logs a WebSocket URL without exposing the auth token (query param `token`).
void debugPrintWsConnect(String prefix, Uri uri, {String? extra}) {
  if (!kDebugMode) return;
  final redacted = _redactToken(uri);
  final suffix = extra != null ? ' $extra' : '';
  debugPrint('[$prefix] WS -> $redacted$suffix');
}

String _redactToken(Uri uri) {
  final q = Map<String, String>.from(uri.queryParameters);
  if (q.containsKey('token')) {
    q['token'] = '…';
  }
  return uri.replace(queryParameters: q).toString();
}
