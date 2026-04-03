import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:dio/dio.dart';

import '../constants/endpoint.dart';

/// HQ app version check: v1 only. If app version < minVersionv1 → force update (no skip).
/// Structure mirrors frontend2 VersionChecker; only check logic is v1-only.
class HqVersionChecker {
  static String? _appVersion;
  static String? _buildNumber;
  static String? _deviceType;
  static bool _updateRequired = false;
  static String? _storeUrl;
  static String? _updateMessage;

  static String getDeviceType() {
    if (kIsWeb) {
      return 'Web';
    } else if (Platform.isAndroid) {
      return 'Android';
    } else if (Platform.isIOS) {
      return 'iOS';
    } else if (Platform.isMacOS) {
      return 'macOS';
    } else if (Platform.isWindows) {
      return 'Windows';
    } else if (Platform.isLinux) {
      return 'Linux';
    } else {
      return 'Unknown';
    }
  }

  static Future<void> init() async {
    _deviceType = getDeviceType();

    // Get app version info
    final packageInfo = await PackageInfo.fromPlatform();
    _appVersion = packageInfo.version;
    _buildNumber = packageInfo.buildNumber;
  }

  /// Check version against server: v1 only. If app version < minVersionv1 → force update.
  static Future<bool> checkForUpdate() async {
    try {
      if (_deviceType != 'Android' && _deviceType != 'iOS') {
        return false;
      }

      // HQ is Android-only; skip check on iOS for consistency with getDeviceType
      if (_deviceType != 'Android') {
        return false;
      }

      final dio = Dio();
      final response = await dio.get(RcAppVersionEndpoints.getAndroidVersion);

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];

        final String minVersionv1 =
            data['minVersionv1'] as String? ?? data['minHQversion'] as String? ?? '1.0.0';
        _storeUrl = data['storeUrl'] as String?;
        _updateMessage = data['updateMessage'] as String?;

        if (_compareVersions(_appVersion!, minVersionv1) >= 0) {
          _updateRequired = false;
          return false;
        } else {
          _updateRequired = true;
          return true;
        }
      }

      return false;
    } catch (e) {
      if (kDebugMode) debugPrint('HqVersionChecker error: $e');
      _updateRequired = false;
      return false;
    }
  }

  /// Compare two versions semantically
  /// Returns: -1 if version1 < version2
  ///           0 if version1 == version2
  ///           1 if version1 > version2
  static int _compareVersions(String version1, String version2) {
    try {
      final v1Parts = version1.split('.').map((e) => int.parse(e)).toList();
      final v2Parts = version2.split('.').map((e) => int.parse(e)).toList();

      final maxLength =
          v1Parts.length > v2Parts.length ? v1Parts.length : v2Parts.length;
      while (v1Parts.length < maxLength) {
        v1Parts.add(0);
      }
      while (v2Parts.length < maxLength) {
        v2Parts.add(0);
      }

      for (int i = 0; i < maxLength; i++) {
        if (v1Parts[i] < v2Parts[i]) {
          return -1;
        }
        if (v1Parts[i] > v2Parts[i]) {
          return 1;
        }
      }

      return 0;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error comparing versions $version1 vs $version2: $e');
      }
      return 0;
    }
  }

  /// Show update required dialog (same UI as frontend2 VersionChecker.showUpdateDialog)
  static Future<void> showUpdateDialog(BuildContext context) async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return PopScope(
          canPop: false,
          child: Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            backgroundColor: Colors.white,
            elevation: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _updateMessage ?? 'Update available. Please update.',
                      style: const TextStyle(
                        color: Color(0xFF1A1A2E),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton(
                      onPressed: () => _openStore(),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4C4EDB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Update',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Open store URL
  static Future<void> _openStore() async {
    if (_storeUrl != null) {
      final uri = Uri.parse(_storeUrl!);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  static Future<void> openStore() async {
    await _openStore();
  }

  // Getters (same as frontend2)
  static String get appVersion => _appVersion ?? 'Unknown';
  static String get buildNumber => _buildNumber ?? 'Unknown';
  static String get deviceType => _deviceType ?? 'Unknown';
  static String get fullVersion => '$appVersion+$buildNumber';
  static bool get updateRequired => _updateRequired;
  static String? get storeUrl => _storeUrl;
  static String get updateMessage =>
      _updateMessage ?? 'Update available. Please update.';
}
