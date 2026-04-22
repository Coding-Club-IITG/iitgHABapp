import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/gala_scan_status_page.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vibration/vibration.dart';

final _dio = DioClient().dio;

/// Expected category for this scanner: Starters, Main Course, or Desserts.
class GalaQRScannerScreen extends StatefulWidget {
  final String expectedCategory;

  const GalaQRScannerScreen({super.key, required this.expectedCategory});

  @override
  State<GalaQRScannerScreen> createState() => _GalaQRScannerScreenState();
}

class _GalaQRScannerScreenState extends State<GalaQRScannerScreen> {
  late MobileScannerController controller;
  bool _hasScanned = false;
  bool _isProcessing = false;
  bool _cameraPermissionGranted = false;
  bool _isCheckingPermission = false;

  static const Color _bg = Colors.white;
  static const Color _appBarBg = Color(0xFFFAFAFA);
  static const Color _border = Color(0xFFE6E6E6);
  static const Color _primary = Color(0xFF4C4EDB);
  static const Color _textPrimary = Color(0xFF2E2F31);
  static const Color _textSecondary = Color(0xFF535353);
  static const double _scanBoxSize = 305;

  static const List<String> _galaScanRuleBodies = [
    'Scan only the official Gala QR for the course you opened this scanner for.',
    'One successful scan updates your course status — scanning again may show as already scanned.',
    'Allow camera access and hold the code steady inside the frame.',
  ];

  @override
  void initState() {
    super.initState();
    controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
      autoStart: false,
    );
    _checkMicrosoftLink().then((_) {
      if (mounted) _initializeCameraPermission();
    });
  }

  Future<void> _checkMicrosoftLink() async {
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
    if (!hasMicrosoftLinked && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          showDialog<void>(
            context: context,
            builder: (context) => const MicrosoftRequiredDialog(
              featureName: 'Gala QR Scanning',
            ),
          );
          Navigator.pop(context);
        }
      });
    }
  }

  Future<void> _initializeCameraPermission() async {
    var status = await Permission.camera.status;
    if (status.isGranted) {
      setState(() {
        _cameraPermissionGranted = true;
      });
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (e) {
          if (mounted) {
            await Future.delayed(const Duration(milliseconds: 500));
            try {
              await controller.start();
            } catch (_) {}
          }
        }
      }
    }
  }

  Future<void> _requestCameraPermission() async {
    if (_isCheckingPermission) return;

    setState(() {
      _isCheckingPermission = true;
    });

    var status = await Permission.camera.status;

    if (status.isGranted) {
      setState(() {
        _cameraPermissionGranted = true;
        _isCheckingPermission = false;
      });
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (e) {
          if (mounted) {
            await Future.delayed(const Duration(milliseconds: 500));
            try {
              await controller.start();
            } catch (_) {}
          }
        }
      }
      return;
    }

    var result = await Permission.camera.request();

    setState(() {
      _isCheckingPermission = false;
    });

    if (result.isGranted) {
      setState(() {
        _cameraPermissionGranted = true;
      });
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (e) {
          if (mounted) {
            await Future.delayed(const Duration(milliseconds: 500));
            try {
              await controller.start();
            } catch (_) {}
          }
        }
      }
    } else if (result.isPermanentlyDenied) {
      _showPermissionDeniedDialog();
    } else {
      _showPermissionDeniedDialog();
    }
  }

  void _showPermissionDeniedDialog() {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          title: const Text(
            'Camera Access Required',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
            ),
          ),
          content: const Text(
            'Camera access is required to scan QR codes. Please enable camera permission in Settings to use this feature.',
            style: TextStyle(
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 14,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(dialogContext);
                openAppSettings();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4C4EDB),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'Open Settings',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  void _showGalaScanRulesSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final bottom = MediaQuery.paddingOf(ctx).bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 16 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: const BoxDecoration(
                    color: Color(0xFFE0E0E0),
                    borderRadius: BorderRadius.all(Radius.circular(999)),
                  ),
                ),
              ),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Gala QR scan',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w500,
                        height: 24 / 18,
                        color: Color(0xFF2E2F31),
                      ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close),
                    color: const Color(0xFF676767),
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(ctx).height * 0.42,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < _galaScanRuleBodies.length; i++) ...[
                        if (i > 0) const SizedBox(height: 12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 22,
                              child: Text(
                                '${i + 1}.',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  height: 20 / 14,
                                  color: Color(0xFF676767),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                _galaScanRuleBodies[i],
                                style: const TextStyle(
                                  fontSize: 14,
                                  height: 20 / 14,
                                  fontWeight: FontWeight.w400,
                                  color: Color(0xFF2E2F31),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(ctx),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2E2F31),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Got it',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  String _categoryHeadline() {
    if (widget.expectedCategory == 'Starters') return 'Starters';
    if (widget.expectedCategory == 'Main Course') return 'Main Course';
    return widget.expectedCategory;
  }

  Future<void> _scanGala(String galaDinnerMenuId) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    final navigator = Navigator.of(context);
    if (kDebugMode) {
      debugPrint(
          'GalaScan: expectedCategory=${widget.expectedCategory} galaDinnerMenuId=$galaDinnerMenuId');
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('userId');
      final accessToken = prefs.getString('access_token');
      if (!mounted) return;
      if (userId == null || accessToken == null) {
        if (kDebugMode) debugPrint('GalaScan: missing userId or accessToken');
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please log in')),
        );
        return;
      }

      if (kDebugMode) debugPrint('GalaScan: POST ${GalaEndpoints.scan}');
      final response = await _dio.post(
        GalaEndpoints.scan,
        data: {
          'userId': userId,
          'galaDinnerMenuId': galaDinnerMenuId,
          'expectedCategory': widget.expectedCategory,
        },
        options: Options(
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Content-Type': 'application/json',
          },
        ),
      );
      if (kDebugMode) {
        debugPrint(
            'GalaScan: response status=${response.statusCode} success=${response.data is Map ? (response.data as Map)['success'] : null} message=${response.data is Map ? (response.data as Map)['message'] : null}');
      }

      final hasVib = await Vibration.hasVibrator();
      if (hasVib == true) Vibration.vibrate(duration: 100);

      if (!mounted) return;
      navigator
          .push<dynamic>(MaterialPageRoute(
        builder: (context) => GalaScanStatusPage(response: response),
      ))
          .then((action) {
        if (mounted) {
          if (action is Map && action['action'] == 'goToGala') {
            navigator.pop(action);
            return;
          }
          if (action == 'goToGala') {
            navigator.pop({'action': 'goToGala'});
            return;
          }
          setState(() {
            _hasScanned = false;
            _isProcessing = false;
          });
          controller.start();
        }
      });
    } catch (e) {
      if (kDebugMode) {
        debugPrint('GalaScan: error=$e');
        if (e is DioException) {
          debugPrint(
              'GalaScan: DioException status=${e.response?.statusCode} data=${e.response?.data}');
        }
      }
      if (!mounted) return;
      String msg = 'Unknown error';
      if (e is DioException && e.response?.data is Map) {
        final d = e.response!.data as Map;
        msg = d['message']?.toString() ?? 'Server error';
      } else if (e is DioException) {
        if (e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout) {
          msg = 'Connection timeout. Please check your internet connection.';
        } else if (e.type == DioExceptionType.connectionError) {
          msg = 'Connection failed. Please check your internet connection.';
        } else {
          msg = e.message ?? 'Network error';
        }
      }
      navigator
          .push<dynamic>(MaterialPageRoute(
        builder: (context) => GalaScanStatusPage(
          response: Response(
            requestOptions: RequestOptions(path: ''),
            statusCode: e is DioException ? e.response?.statusCode ?? 500 : 500,
            data: {'success': false, 'message': msg},
          ),
        ),
      ))
          .then((action) {
        if (mounted) {
          if (action is Map && action['action'] == 'goToGala') {
            navigator.pop(action);
            return;
          }
          if (action == 'goToGala') {
            navigator.pop({'action': 'goToGala'});
            return;
          }
          setState(() {
            _hasScanned = false;
            _isProcessing = false;
          });
          controller.start();
        }
      });
    }
  }

  void _onBarcodeDetected(BarcodeCapture capture) {
    if (_hasScanned || _isProcessing) return;
    setState(() => _hasScanned = true);
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.isNotEmpty) {
        controller.stop();
        _scanGala(value);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _appBarBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        foregroundColor: _textPrimary,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: _border),
        ),
        title: const Text(
          'Scan QR',
          style: TextStyle(
            color: _textPrimary,
            fontSize: 20,
            height: 28 / 20,
            fontWeight: FontWeight.w500,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Gala QR tips',
            onPressed: _showGalaScanRulesSheet,
            icon: const Icon(Icons.info_outline),
            color: const Color(0xFF676767),
          ),
        ],
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: !_cameraPermissionGranted
          ? _buildPermissionOverlay()
          : Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                  children: [
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 32,
                          height: 48 / 32,
                          fontWeight: FontWeight.w500,
                        ),
                        children: [
                          TextSpan(
                            text: '${_categoryHeadline()} · ',
                            style: const TextStyle(color: _textPrimary),
                          ),
                          const TextSpan(
                            text: 'Scan QR',
                            style: TextStyle(color: _primary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 36),
                    Center(
                      child: SizedBox(
                        width: _scanBoxSize,
                        height: _scanBoxSize,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.zero,
                              child: MobileScanner(
                                controller: controller,
                                onDetect: _onBarcodeDetected,
                                errorBuilder: (context, error) {
                                  return Center(
                                    child: Text(
                                      'Camera Error: ${error.errorDetails?.message ?? "Unknown error"}',
                                      style: const TextStyle(
                                        color: _textSecondary,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  );
                                },
                              ),
                            ),
                            IgnorePointer(
                              child: Container(
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: _primary,
                                    width: 4,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Hold your QR code steady within the frame',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        height: 20 / 16,
                        fontWeight: FontWeight.w500,
                        color: _textSecondary,
                      ),
                    ),
                  ],
                ),
                if (_isProcessing)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFFE5E7EB),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildPermissionOverlay() {
    return Container(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.camera_alt_outlined,
                size: 80,
                color: Color(0xFFE5E7EB),
              ),
              const SizedBox(height: 32),
              const Text(
                'Camera Access Needed',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              const Text(
                'We need access to your camera to scan QR codes for Gala check-in.',
                style: TextStyle(
                  color: Color.fromRGBO(255, 255, 255, 0.7),
                  fontSize: 16,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              if (_isCheckingPermission)
                const CircularProgressIndicator(
                  color: Color(0xFFE5E7EB),
                )
              else
                ElevatedButton(
                  onPressed: _requestCameraPermission,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4C4EDB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 48,
                      vertical: 14,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'Continue',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
