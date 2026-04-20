import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../apis/caterer_auth_api.dart';
import '../storage/manager_token_storage.dart';

const _kHostelNameKey = 'mm_hostelName';

/// Session for HABit HQ: access JWT + optional caterer refresh token + hostel display name.
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

  Future<String?> readRefreshToken() => ManagerTokenStorage.readRefreshToken();

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

  /// Password login (HABit RC–style): no refresh token; 401 cannot be silently refreshed.
  Future<void> signIn({
    required String token,
    required String hostelName,
    bool passwordLogin = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await ManagerTokenStorage.writeToken(token);
    await prefs.setString(_kHostelNameKey, hostelName);
    if (passwordLogin) {
      await ManagerTokenStorage.deleteRefreshToken();
    }
    _token = token;
    _hostelName = hostelName;
    notifyListeners();
  }

  /// Caterer Google login: access + long-lived refresh.
  Future<void> signInWithCatererTokens({
    required String token,
    required String hostelName,
    required String refreshToken,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await ManagerTokenStorage.writeToken(token);
    await ManagerTokenStorage.writeRefreshToken(refreshToken);
    await prefs.setString(_kHostelNameKey, hostelName);
    _token = token;
    _hostelName = hostelName;
    notifyListeners();
  }

  /// After successful [CatererAuthApi.tryRefresh].
  Future<void> applyRefreshedTokens({
    required String access,
    required String refresh,
  }) async {
    await ManagerTokenStorage.writeToken(access);
    await ManagerTokenStorage.writeRefreshToken(refresh);
    _token = access;
    notifyListeners();
  }

  Future<void> signOut() async {
    final refresh = await ManagerTokenStorage.readRefreshToken();
    if (refresh != null && refresh.isNotEmpty) {
      await CatererAuthApi.logoutRefresh(refresh);
    }
    final prefs = await SharedPreferences.getInstance();
    await ManagerTokenStorage.deleteToken();
    await ManagerTokenStorage.deleteRefreshToken();
    await prefs.remove(_kHostelNameKey);
    _token = null;
    _hostelName = null;
    notifyListeners();
  }
}
