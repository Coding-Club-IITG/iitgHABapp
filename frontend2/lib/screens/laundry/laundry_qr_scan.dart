import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:vibration/vibration.dart';

import '../../apis/laundry/laundry_api.dart';
import '../../widgets/common/snack_bar.dart';

class LaundryQrScanScreen extends StatefulWidget {
  const LaundryQrScanScreen({super.key});

  @override
  State<LaundryQrScanScreen> createState() => _LaundryQrScanScreenState();
}

class _LaundryQrScanScreenState extends State<LaundryQrScanScreen> {
  late MobileScannerController controller;
  bool _hasScanned = false;
  bool _isProcessing = false;
  bool _cameraPermissionGranted = false;
  bool _isCheckingPermission = false;
  final LaundryApi _api = LaundryApi();

  @override
  void initState() {
    super.initState();
    _initializeCameraPermission();
    controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
      autoStart: false,
    );
  }

  Future<void> _initializeCameraPermission() async {
    var status = await Permission.camera.status;
    if (status.isGranted) {
      setState(() => _cameraPermissionGranted = true);
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (_) {}
      }
    }
  }

  Future<void> _requestCameraPermission() async {
    if (_isCheckingPermission) return;
    setState(() => _isCheckingPermission = true);
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
        } catch (_) {}
      }
      return;
    }
    var result = await Permission.camera.request();
    setState(() => _isCheckingPermission = false);
    if (result.isGranted) {
      setState(() => _cameraPermissionGranted = true);
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (_) {}
      }
    } else {
      _showPermissionDeniedDialog();
    }
  }

  void _showPermissionDeniedDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text(
          'Camera Access Required',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        content: const Text(
          'Camera access is required to scan the laundry QR code. Please enable it in Settings.',
          style: TextStyle(fontSize: 14, color: Colors.black87),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF3754DB),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: const Text('Open Settings', style: TextStyle(color: Colors.white)),
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

  Future<void> _onScan(String payload) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    final navigator = Navigator.of(context);

    try {
      await _api.scan(scannedPayload: payload);
      final hasVib = await Vibration.hasVibrator();
      if (hasVib == true) Vibration.vibrate(duration: 100);
      if (!mounted) return;
      showSnackBar('Laundry service availed successfully', Colors.green, context);
      navigator.pop(true);
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (!mounted) return;
      showSnackBar(msg, Colors.red, context);
      setState(() {
        _hasScanned = false;
        _isProcessing = false;
      });
      try {
        await controller.start();
      } catch (_) {}
    }
  }

  void onBarcodeDetected(BarcodeCapture capture) {
    if (_hasScanned || _isProcessing) return;
    setState(() => _hasScanned = true);
    for (final barcode in capture.barcodes) {
      final result = barcode.rawValue;
      if (result != null && result.isNotEmpty) {
        controller.stop();
        _onScan(result);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text(
          'Laundry Scanner',
          style: TextStyle(color: Colors.white, fontSize: 18),
        ),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: !_cameraPermissionGranted
          ? _buildPermissionOverlay()
          : Stack(
              children: [
                MobileScanner(
                  controller: controller,
                  onDetect: onBarcodeDetected,
                  errorBuilder: (context, error) => Center(
                    child: Text(
                      'Camera Error: ${error.errorDetails?.message ?? "Unknown"}',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                ),
                Center(
                  child: SizedBox(
                    width: 250,
                    height: 250,
                    child: CustomPaint(
                      size: const Size(250, 250),
                      painter: _CornerFramePainter(),
                    ),
                  ),
                ),
                const Positioned(
                  bottom: 40,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Text(
                      'Scan the laundry QR code',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
                if (_isProcessing)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                      child: CircularProgressIndicator(color: Color(0xFF3754DB)),
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
                color: Color(0xFF3754DB),
              ),
              const SizedBox(height: 32),
              const Text(
                'Camera Access Needed',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              const Text(
                'We need camera access to scan the laundry QR code.',
                style: TextStyle(
                  color: Color.fromRGBO(255, 255, 255, 0.7),
                  fontSize: 16,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              if (_isCheckingPermission)
                const CircularProgressIndicator(color: Color(0xFF3754DB))
              else
                ElevatedButton(
                  onPressed: _requestCameraPermission,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3754DB),
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
                      fontWeight: FontWeight.w600,
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

class _CornerFramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const color = Color(0xFF3754DB);
    const strokeWidth = 4.0;
    const cornerLength = 32.0;
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    // Top-left
    canvas.drawPath(
      Path()
        ..moveTo(0, cornerLength)
        ..lineTo(0, 0)
        ..lineTo(cornerLength, 0),
      paint,
    );
    // Top-right
    canvas.drawPath(
      Path()
        ..moveTo(size.width - cornerLength, 0)
        ..lineTo(size.width, 0)
        ..lineTo(size.width, cornerLength),
      paint,
    );
    // Bottom-right
    canvas.drawPath(
      Path()
        ..moveTo(size.width, size.height - cornerLength)
        ..lineTo(size.width, size.height)
        ..lineTo(size.width - cornerLength, size.height),
      paint,
    );
    // Bottom-left
    canvas.drawPath(
      Path()
        ..moveTo(cornerLength, size.height)
        ..lineTo(0, size.height)
        ..lineTo(0, size.height - cornerLength),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
