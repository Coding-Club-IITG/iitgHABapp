import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/gala_scan_status_page.dart';
import 'package:frontend2/widgets/common/cornerQR.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:dio/dio.dart';
import 'package:vibration/vibration.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';

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
          showDialog(
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
    setState(() => _isCheckingPermission = true);
    final status = await Permission.camera.status;
    if (!mounted) return;
    setState(() {
      _isCheckingPermission = false;
      _cameraPermissionGranted = status.isGranted;
    });
    bool hasPermission = status.isGranted;
    if (status.isDenied) {
      final result = await Permission.camera.request();
      if (mounted) {
        setState(() => _cameraPermissionGranted = result.isGranted);
      }
      hasPermission = result.isGranted;
      if (result.isPermanentlyDenied && mounted) {
        _showPermissionDeniedDialog();
      }
    }
    // With autoStart: false, we must start the controller after permission is granted
    if (hasPermission && mounted) {
      await Future.delayed(const Duration(milliseconds: 300));
      if (!mounted) return;
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

  void _showPermissionDeniedDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Camera Access Required',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        content: const Text(
          'Camera access is required to scan Gala QR codes. Please enable camera permission in Settings.',
          style: TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4C4EDB),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16))),
            child: const Text('Open Settings',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> _scanGala(String galaDinnerMenuId) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    final navigator = Navigator.of(context);
    if (kDebugMode)
      debugPrint(
          'GalaScan: expectedCategory=${widget.expectedCategory} galaDinnerMenuId=$galaDinnerMenuId');

    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('userId');
      final accessToken = prefs.getString('access_token');
      if (!mounted) return;
      if (userId == null || accessToken == null) {
        if (kDebugMode) debugPrint('GalaScan: missing userId or accessToken');
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Please log in')));
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
      if (kDebugMode)
        debugPrint(
            'GalaScan: response status=${response.statusCode} success=${response.data is Map ? (response.data as Map)['success'] : null} message=${response.data is Map ? (response.data as Map)['message'] : null}');

      final hasVib = await Vibration.hasVibrator();
      if (hasVib == true) Vibration.vibrate(duration: 100);

      if (!mounted) return;
      navigator
          .push(MaterialPageRoute(
        builder: (context) => GalaScanStatusPage(response: response),
      ))
          .then((_) {
        if (mounted) {
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
        if (e is DioException)
          debugPrint(
              'GalaScan: DioException status=${e.response?.statusCode} data=${e.response?.data}');
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
          .push(MaterialPageRoute(
        builder: (context) => GalaScanStatusPage(
          response: Response(
            requestOptions: RequestOptions(path: ''),
            statusCode: e is DioException ? e.response?.statusCode ?? 500 : 500,
            data: {'success': false, 'message': msg},
          ),
        ),
      ))
          .then((_) {
        if (mounted) {
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
    final title = widget.expectedCategory == 'Main Course'
        ? 'Main Course'
        : widget.expectedCategory;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: !_cameraPermissionGranted
          ? _buildPermissionOverlay()
          : Stack(
              children: [
                MobileScanner(
                  controller: controller,
                  onDetect: _onBarcodeDetected,
                  errorBuilder: (context, error) => Center(
                    child: Text(
                      'Camera Error: ${error.errorDetails?.message ?? "Unknown"}',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                ),
                _buildScannerUI(),
                if (_isProcessing)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xFF4C4EDB))),
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
              const Icon(Icons.camera_alt_outlined,
                  size: 80, color: Color(0xFF4C4EDB)),
              const SizedBox(height: 32),
              const Text('Camera Access Needed',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              const Text('We need camera access to scan Gala QR codes.',
                  style: TextStyle(
                      color: Color.fromRGBO(255, 255, 255, 0.7), fontSize: 16),
                  textAlign: TextAlign.center),
              const SizedBox(height: 40),
              _isCheckingPermission
                  ? const CircularProgressIndicator(color: Color(0xFF4C4EDB))
                  : ElevatedButton(
                      onPressed: _initializeCameraPermission,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4C4EDB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 48, vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Continue',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildScannerUI() {
    return Column(
      children: [
        const SizedBox(height: 80),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Scan ${widget.expectedCategory} QR',
            style: const TextStyle(
                color: Color.fromRGBO(255, 255, 255, 0.9),
                fontSize: 22,
                fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 40),
        Center(
          child: SizedBox(
            width: 250,
            height: 250,
            child: CustomPaint(
                size: const Size(250, 250), painter: CornerPainter()),
          ),
        ),
        const SizedBox(height: 40),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Hold the QR code steady within the frame',
            style: TextStyle(color: Colors.white, fontSize: 16),
            textAlign: TextAlign.center,
          ),
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.only(bottom: 40),
          child: IconButton(
            icon: const Icon(Icons.cameraswitch, color: Colors.white, size: 32),
            onPressed: () => controller.switchCamera(),
            tooltip: 'Switch Camera',
          ),
        ),
      ],
    );
  }
}
