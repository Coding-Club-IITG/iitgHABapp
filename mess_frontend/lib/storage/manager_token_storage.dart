import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the manager JWT in secure storage. Migrates legacy [SharedPreferences] key `mm_token`.
class ManagerTokenStorage {
  ManagerTokenStorage._();

  static const _storageKey = 'mm_manager_jwt';
  static const _legacyPrefsKey = 'mm_token';

  static const FlutterSecureStorage _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> readToken() => _secure.read(key: _storageKey);

  static Future<void> writeToken(String token) =>
      _secure.write(key: _storageKey, value: token);

  static Future<void> deleteToken() => _secure.delete(key: _storageKey);

  /// One-time migration from plain SharedPreferences to secure storage.
  static Future<void> migrateLegacyFromPrefs(SharedPreferences prefs) async {
    final legacy = prefs.getString(_legacyPrefsKey);
    if (legacy == null || legacy.isEmpty) return;
    final existing = await readToken();
    if (existing == null || existing.isEmpty) {
      await writeToken(legacy);
    }
    await prefs.remove(_legacyPrefsKey);
  }
}
