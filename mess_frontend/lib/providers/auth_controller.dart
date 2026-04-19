import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../storage/manager_token_storage.dart';

const _kHostelNameKey = 'mm_hostelName';

/// Session for the mess manager: JWT + selected hostel name.
class AuthController extends ChangeNotifier {
  String? _token;
  String? _hostelName;

  String? get token => _token;
  String? get hostelName => _hostelName;

  bool get isAuthenticated =>
      _token != null &&
      _token!.isNotEmpty &&
      _hostelName != null &&
      _hostelName!.isNotEmpty;

  /// Load token (secure + legacy migration) and hostel from preferences.
  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    await ManagerTokenStorage.migrateLegacyFromPrefs(prefs);
    _token = await ManagerTokenStorage.readToken();
    _hostelName = prefs.getString(_kHostelNameKey);
    if (_token != null &&
        _token!.isNotEmpty &&
        (_hostelName == null || _hostelName!.isEmpty)) {
      await signOut();
      return;
    }
    notifyListeners();
  }

  Future<void> signIn({
    required String token,
    required String hostelName,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await ManagerTokenStorage.writeToken(token);
    await prefs.setString(_kHostelNameKey, hostelName);
    _token = token;
    _hostelName = hostelName;
    notifyListeners();
  }

  Future<void> signOut() async {
    final prefs = await SharedPreferences.getInstance();
    await ManagerTokenStorage.deleteToken();
    await prefs.remove(_kHostelNameKey);
    _token = null;
    _hostelName = null;
    notifyListeners();
  }
}
