import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:frontend2/constants/endpoint.dart';

class VersionChecker {
  static String? _appVersion;
  static String? _buildNumber;
  static String? _deviceType;
  static bool _updateRequired = false;
  static String? _storeUrl;
  static String? _updateMessage;

  // Defaults to 'v1' (Latest) until we check with the server
  static String _apiVersion = 'v1';

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

  /// Returns the headers to be injected into Dio requests
  static Map<String, dynamic> getApiHeaders() {
    return {
      'x-api-version': _apiVersion,
    };
  }

  /// Check version against server logic:
  /// 1. If app version >= v1 minVersion -> Use V1 API
  /// 2. Else if app version >= v2 minVersion -> Use V2 API (Legacy)
  /// 3. Else -> Force Update
  static Future<bool> checkForUpdate() async {
    try {
      if (_deviceType != 'Android' && _deviceType != 'iOS') {
        return false;
      }

      final dio = DioClient().dio;

      // Note: Version check endpoint is in gateway, doesn't need routing header
      // API version header only needed for subsequent API calls after version is determined

      final endpoint = _deviceType == 'Android'
          ? AppVersionEndpoints.getAndroidVersion
          : AppVersionEndpoints.getIosVersion;

      final response = await dio.get(endpoint);

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];

        // Get minimum versions from both v1 and v2 configs
        final String v1MinVersion = data['v1']['minVersion'] ?? '1.0.0';
        final String v2MinVersion = data['v2']['minVersion'] ?? '1.0.0';

        _storeUrl = data['v1']['storeUrl'] as String?;
        _updateMessage = data['v1']['updateMessage'] as String?;

        // --- CORE LOGIC START ---

        // Check if app version satisfies v1 minimum requirement
        if (_compareVersions(_appVersion!, v1MinVersion) >= 0) {
          // App version meets v1 requirements
          _apiVersion = 'v1';
          _updateRequired = false;
        }
        // Check if app version satisfies v2 minimum requirement (legacy)
        else if (_compareVersions(_appVersion!, v2MinVersion) >= 0) {
          // App version meets v2 (legacy) requirements
          _apiVersion = 'v2';
          _updateRequired = false;
        }
        // Neither v1 nor v2 requirements met
        else {
          // FORCE UPDATE required
          _updateRequired = true;
          return true;
        }

        // --- CORE LOGIC END ---
      }

      return false;
    } catch (e) {
      // If check fails, default to V1 and allow app usage
      _apiVersion = 'v1';
      return false;
    }
  }

  /// Compare two versions semantically
  /// Returns: -1 if version1 < version2
  ///           0 if version1 == version2
  ///           1 if version1 > version2
  /// Example: _compareVersions('1.2.0', '1.2.1') returns -1
  static int _compareVersions(String version1, String version2) {
    try {
      final v1Parts = version1.split('.').map((e) => int.parse(e)).toList();
      final v2Parts = version2.split('.').map((e) => int.parse(e)).toList();

      // Pad with zeros if lengths differ
      final maxLength =
          v1Parts.length > v2Parts.length ? v1Parts.length : v2Parts.length;
      while (v1Parts.length < maxLength) {
        v1Parts.add(0);
      }
      while (v2Parts.length < maxLength) {
        v2Parts.add(0);
      }

      // Compare each part
      for (int i = 0; i < maxLength; i++) {
        if (v1Parts[i] < v2Parts[i]) return -1;
        if (v1Parts[i] > v2Parts[i]) return 1;
      }

      return 0; // Equal
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error comparing versions $version1 vs $version2: $e');
      }
      return 0; // Default to equal if error
    }
  }

  /// Show update required dialog
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

  // Getters
  static String get appVersion => _appVersion ?? 'Unknown';
  static String get buildNumber => _buildNumber ?? 'Unknown';
  static String get deviceType => _deviceType ?? 'Unknown';
  static String get fullVersion => '$appVersion+$buildNumber';
  static bool get updateRequired => _updateRequired;
  static String? get storeUrl => _storeUrl;
  static String get updateMessage =>
      _updateMessage ?? 'Update available. Please update.';

  // Getter for the API Version (used by Dio Interceptors)
  static String get apiVersion => _apiVersion;
}
