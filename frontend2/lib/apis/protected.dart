import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

String _maskToken(String token) {
  final t = token.trim();
  if (t.length <= 12) return '***';
  return '${t.substring(0, 6)}…${t.substring(t.length - 6)}';
}

Future<String> getAccessToken() async {
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('access_token');

  if (token != null) {
    // Debug-only: never print full tokens to logs.
    if (kDebugMode) {
      debugPrint('[Auth] access_token=${_maskToken(token)}');
    }
    return token;
  } else {
    return 'error';
  }
}




