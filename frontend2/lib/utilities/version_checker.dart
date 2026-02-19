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
  /// 1. Same Major Version -> Use V1 (Latest)
  /// 2. 1 Major Version Behind -> Use V2 (Legacy)
  /// 3. 2+ Major Versions Behind -> Force Update
  static Future<bool> checkForUpdate() async {
    try {
      if (_deviceType != 'Android' && _deviceType != 'iOS') {
        return false;
      }

      final dio = DioClient().dio;

      // Inject current header so the version check itself goes to the right place
      dio.options.headers.addAll(getApiHeaders());

      final endpoint = _deviceType == 'Android'
          ? AppVersionEndpoints.getAndroidVersion
          : AppVersionEndpoints.getIosVersion;

      final response = await dio.get(endpoint);

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];

        // IMPORTANT: We need the SERVER'S LATEST VERSION to compare against.
        // Ensure your API returns 'latestVersion' or fallback to 'minVersion'
        final String serverVersion =
            data['latestVersion'] ?? data['minVersion'] ?? '1.0.0';

        _storeUrl = data['storeUrl'] as String?;
        _updateMessage = data['updateMessage'] as String?;

        // --- CORE LOGIC START ---
        int localMajor = _getMajorVersion(_appVersion!);
        int serverMajor = _getMajorVersion(serverVersion);
        int diff = serverMajor - localMajor;

        if (diff <= 0) {
          // Case: App is equal to (or newer than) Server
          _apiVersion = 'v1';
          _updateRequired = false;
        } else if (diff == 1) {
          // Case: App is 1 version behind (13 vs 14)
          // Use Legacy API
          _apiVersion = 'v2';
          _updateRequired = false;
        } else {
          // Case: App is 2+ versions behind (13 vs 15)
          // Force Update
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

  /// Helper to extract "13" from "13.2.1"
  static int _getMajorVersion(String version) {
    try {
      return int.parse(version.split('.')[0]);
    } catch (e) {
      if (kDebugMode) debugPrint('Error parsing major version from $version: $e');
      return 0;
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
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Update icon
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF0F4FF),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.system_update_alt_rounded,
                      color: Color(0xFF4C4EDB),
                      size: 48,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Title
                  const Text(
                    'Update Available',
                    style: TextStyle(
                      color: Color(0xFF1A1A2E),
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Message
                  Text(
                    _updateMessage ??
                        'A new version of the app is available. Please update to continue using the app.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Version info
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Current version: $_appVersion',
                      style: const TextStyle(
                        color: Color(0xFF9CA3AF),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Update button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => _openStore(),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4C4EDB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _deviceType == 'Android'
                                ? Icons.play_arrow_rounded
                                : Icons.apple_rounded,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Update Now',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
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

  // Getters
  static String get appVersion => _appVersion ?? 'Unknown';
  static String get buildNumber => _buildNumber ?? 'Unknown';
  static String get deviceType => _deviceType ?? 'Unknown';
  static String get fullVersion => '$appVersion+$buildNumber';
  static bool get updateRequired => _updateRequired;
  static String? get storeUrl => _storeUrl;

  // Getter for the API Version (used by Dio Interceptors)
  static String get apiVersion => _apiVersion;
}
