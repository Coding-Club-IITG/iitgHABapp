import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/screens/scan_status.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/widgets/common/snack_bar.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:dio/dio.dart';
import 'package:vibration/vibration.dart';
import 'package:frontend2/widgets/common/cornerQR.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';

final dio = DioClient().dio;

class QrScan extends StatefulWidget {
  const QrScan({super.key});

  @override
  State<QrScan> createState() => _QrScanState();
}

class _QrScanState extends State<QrScan> {
  late MobileScannerController controller;
  bool _hasScanned = false;
  bool _isProcessing = false;
  bool _cameraPermissionGranted = false;
  bool _profilePicMissing = false;
  bool _isCheckingPermission = false;

  @override
  void initState() {
    super.initState();
    _checkMicrosoftLink().then((_) {
      // Only check profile pic if user is not a guest (widget still mounted)
      if (mounted) {
        _checkProfilePic();
        _initializeCameraPermission();
      }
    });
    controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
      autoStart:
          false, // Disable autoStart to manually control when camera starts
    );
  }

  Future<void> _checkMicrosoftLink() async {
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;

    // Allow guest and Apple users to access the QR scanner screen
    // They will be prompted to link Microsoft account when they actually try to scan
    // This matches the flow for Apple users
    if (!hasMicrosoftLinked && mounted) {
      // Show dialog to link Microsoft account, then navigate back
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          showDialog(
            context: context,
            builder: (context) => const MicrosoftRequiredDialog(
              featureName: 'QR Code Scanning',
            ),
          );
          // Navigate back
          Navigator.pop(context);
        }
      });
      return;
    }
  }

  void _checkProfilePic() async {
    // Don't show profile pic dialog for guest or Apple users (Microsoft not linked)
    // They should link their account first
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;

    // Skip profile pic check for guest and Apple users
    if (!hasMicrosoftLinked) {
      return;
    }

    // Only check profile pic for Microsoft-linked users
    if (ProfilePictureProvider.profilePictureString.value.isEmpty) {
      setState(() {
        _profilePicMissing = true;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showProfilePicDialog();
      });
    }
  }

  void _showProfilePicDialog() {
    // Don't show dialog if widget is disposed
    if (!mounted) return;

    final navigator = Navigator.of(context);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return PopScope(
          canPop: false,
          child: AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            title: const Text(
              'Profile Picture Required',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                fontFamily: 'OpenSans_regular',
              ),
            ),
            content: const Text(
              'You need to upload a profile picture to scan mess QR. Please go to your profile and add a profile picture.',
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
                fontFamily: 'OpenSans_regular',
              ),
            ),
            actions: [
              ElevatedButton(
                onPressed: () {
                  if (mounted) {
                    setState(() {
                      _profilePicMissing = false; // Allow pop temporarily
                    });
                  }
                  Navigator.of(dialogContext).pop(); // Close dialog
                  navigator.pop(); // Go back to previous screen
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4C4EDB),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Text(
                  'Go Back',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'OpenSans_regular',
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _initializeCameraPermission() async {
    var status = await Permission.camera.status;
    if (status.isGranted) {
      setState(() {
        _cameraPermissionGranted = true;
      });
      // Wait for controller to be ready before starting
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (e) {
          // Controller might still be initializing, try again after a delay
          if (mounted) {
            await Future.delayed(const Duration(milliseconds: 500));
            try {
              await controller.start();
            } catch (_) {
              // If still failing, let the user retry manually
            }
          }
        }
      }
    }
    // If not granted, the overlay will be shown in the build method
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
      // Wait for controller to be ready before starting
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (e) {
          // Controller might still be initializing, try again after a delay
          if (mounted) {
            await Future.delayed(const Duration(milliseconds: 500));
            try {
              await controller.start();
            } catch (_) {
              // If still failing, let the user retry manually
            }
          }
        }
      }
      return;
    }

    // Request permission - this will show the system dialog
    var result = await Permission.camera.request();

    setState(() {
      _isCheckingPermission = false;
    });

    if (result.isGranted) {
      setState(() {
        _cameraPermissionGranted = true;
      });
      // Wait for controller to be ready before starting
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        try {
          await controller.start();
        } catch (e) {
          // Controller might still be initializing, try again after a delay
          if (mounted) {
            await Future.delayed(const Duration(milliseconds: 500));
            try {
              await controller.start();
            } catch (_) {
              // If still failing, let the user retry manually
            }
          }
        }
      }
    } else if (result.isPermanentlyDenied) {
      // Permission permanently denied - show dialog with Settings link
      _showPermissionDeniedDialog();
    } else {
      // Permission denied but not permanently - show dialog with Settings link
      _showPermissionDeniedDialog();
    }
  }

  void _showPermissionDeniedDialog() {
    showDialog(
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
              fontWeight: FontWeight.w600,
              fontFamily: 'OpenSans_regular',
            ),
          ),
          content: const Text(
            'Camera access is required to scan QR codes. Please enable camera permission in Settings to use this feature.',
            style: TextStyle(
              fontSize: 14,
              color: Colors.black87,
              fontFamily: 'OpenSans_regular',
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
                  fontFamily: 'OpenSans_regular',
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
                  fontWeight: FontWeight.w600,
                  fontFamily: 'OpenSans_regular',
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> scanMess(String messID) async {
    if (_isProcessing) return;

    setState(() {
      _isProcessing = true;
    });

    // capture navigator early to avoid using BuildContext after awaits
    final navigator = Navigator.of(context);

    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('userId');
      final accessToken = prefs.getString('access_token');

      // Ensure widget is still mounted before using the BuildContext
      if (!mounted) return;

      if (userId == null) {
        showSnackBar('User not logged in', Colors.red, context);
        return;
      }

      final url = "$baseUrl/mess/scan/$messID";

      final response = await dio.post(
        url,
        data: {
          'userId': userId,
        },
        options: Options(
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Content-Type': 'application/json',
          },
        ),
      );

      final hasVib = await Vibration.hasVibrator();
      if (hasVib == true) {
        Vibration.vibrate(duration: 100);
      }

      if (!mounted) return;

      navigator
          .push(
        MaterialPageRoute(
          builder: (context) => ScanStatusPage(response: response),
        ),
      )
          .then((_) {
        setState(() {
          _hasScanned = false;
          _isProcessing = false;
        });
        controller.start();
      });
    } catch (e) {
      String errorMessage = 'Unknown error';
      if (e is DioException) {
        if (e.response != null && e.response?.data != null) {
          final data = e.response?.data;
          if (data is Map) {
            errorMessage = data['message']?.toString() ?? 'Server error';
          } else {
            errorMessage = 'Server error (${e.response?.statusCode})';
          }
        } else if (e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout) {
          errorMessage =
              'Connection timeout. Please check your internet connection.';
        } else if (e.type == DioExceptionType.connectionError) {
          errorMessage =
              'Connection failed. Please check your internet connection.';
        } else {
          errorMessage = e.message ?? 'Network error';
        }
      } else {
        errorMessage = e.toString();
      }

      if (!mounted) return;

      navigator
          .push(
        MaterialPageRoute(
          builder: (context) => ScanStatusPage(
            response: Response(
              requestOptions: RequestOptions(path: ''),
              statusCode: 500,
              data: {'message': errorMessage},
            ),
          ),
        ),
      )
          .then((_) {
        setState(() {
          _hasScanned = false;
          _isProcessing = false;
        });
        controller.start();
      });
    }
  }

  void onBarcodeDetected(BarcodeCapture capture) async {
    if (_hasScanned || _isProcessing) return;

    // Check if Microsoft is linked before allowing scan (for guest and Apple users)
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;

    if (!hasMicrosoftLinked) {
      // Show dialog to link Microsoft account
      if (mounted) {
        controller.stop();
        showDialog(
          context: context,
          builder: (context) => const MicrosoftRequiredDialog(
            featureName: 'QR Code Scanning',
          ),
        );
      }
      return;
    }

    setState(() {
      _hasScanned = true;
    });

    for (final barcode in capture.barcodes) {
      final result = barcode.rawValue;
      if (result != null) {
        controller.stop();
        scanMess(result);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_profilePicMissing,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _profilePicMissing) {
          // Show the dialog again if they try to dismiss it
          _showProfilePicDialog();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          title: const Text('Mess Scanner'),
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              if (!_profilePicMissing) {
                Navigator.of(context).pop();
              } else {
                _showProfilePicDialog();
              }
            },
          ),
        ),
        body: _profilePicMissing
            ? Container(
                color: Colors.black,
                child: const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF4C4EDB),
                  ),
                ),
              )
            : !_cameraPermissionGranted
                ? _buildPermissionOverlay()
                : Stack(
                    children: [
                      MobileScanner(
                        controller: controller,
                        onDetect: onBarcodeDetected,
                        errorBuilder: (context, error) {
                          return Center(
                            child: Text(
                              'Camera Error: ${error.errorDetails?.message ?? "Unknown error"}',
                              style: const TextStyle(color: Colors.white),
                            ),
                          );
                        },
                      ),
                      _buildScannerUI(),
                      if (_isProcessing)
                        Container(
                          color: Colors.black54,
                          child: const Center(
                            child: CircularProgressIndicator(
                              color: Color(0xFF4C4EDB),
                            ),
                          ),
                        ),
                    ],
                  ),
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
                color: Color(0xFF4C4EDB),
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
                'We need access to your camera to scan QR codes for mess entry.',
                style: TextStyle(
                  color: Color.fromRGBO(255, 255, 255, 0.7),
                  fontSize: 16,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              if (_isCheckingPermission)
                const CircularProgressIndicator(
                  color: Color(0xFF4C4EDB),
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
                      fontWeight: FontWeight.w600,
                      fontFamily: 'OpenSans_regular',
                    ),
                  ),
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
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Ready to Eat?',
                    style: TextStyle(
                      color: Color.fromRGBO(255, 255, 255, 0.7),
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    ' Scan',
                    style: TextStyle(
                      color: Color(0xFF4C4EDB),
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Text(
                'to Enter',
                style: TextStyle(
                  color: Color(0xFF4C4EDB),
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 40),
        Center(
          child: SizedBox(
            width: 250,
            height: 250,
            child: CustomPaint(
              size: const Size(250, 250),
              painter: CornerPainter(),
            ),
          ),
        ),
        const SizedBox(height: 40),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Hold your QR code steady within the frame',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const Spacer(),
        // Camera toggle button
        Padding(
          padding: const EdgeInsets.only(bottom: 40),
          child: IconButton(
            icon: const Icon(
              Icons.cameraswitch,
              color: Colors.white,
              size: 32,
            ),
            onPressed: () {
              controller.switchCamera();
            },
            tooltip: 'Switch Camera',
          ),
        ),
      ],
    );
  }
}
