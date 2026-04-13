import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/mess/mess_menu.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/models/mess_menu_model.dart';
import 'package:frontend2/screens/initial_setup_screen.dart'
    show ProfilePictureProvider;
import 'package:frontend2/screens/scan_status.dart';
import 'package:frontend2/widgets/common/snack_bar.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vibration/vibration.dart';

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

  Timer? _mealCountdownTimer;

  static const List<String> _messScanRuleBodies = [
    'Scan only the official mess QR during the published meal hours for your mess.',
    'One successful scan per meal is enough — scanning again may show as already entered.',
    'Keep a clear profile photo on file; it may be required for mess entry.',
    'Allow camera access and hold the code steady inside the frame.',
  ];

  static const Color _bg = Colors.white;
  static const Color _appBarBg = Color(0xFFFAFAFA);
  static const Color _border = Color(0xFFE6E6E6);
  static const Color _primary = Color(0xFF4C4EDB);
  static const Color _textPrimary = Color(0xFF2E2F31);
  static const Color _textSecondary = Color(0xFF535353);
  static const double _scanBoxSize = 305;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _refreshMealSessionCountdown();
      _mealCountdownTimer?.cancel();
      _mealCountdownTimer = Timer.periodic(
        const Duration(seconds: 30),
        (_) {
          if (mounted) _refreshMealSessionCountdown();
        },
      );
    });
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
                fontWeight: FontWeight.w500,
              ),
            ),
            content: const Text(
              'You need to upload a profile picture to scan mess QR. Please go to your profile and add a profile picture.',
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
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
                    fontWeight: FontWeight.w500,
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

  String _weekdayName() {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return days[DateTime.now().weekday - 1];
  }

  DateTime _parseMenuClock(String timeStr) {
    final now = DateTime.now();
    final parts = timeStr.split(':');
    if (parts.length < 2) return now;
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    return DateTime(now.year, now.month, now.day, h, m);
  }

  Future<void> _refreshMealSessionCountdown() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final messId = prefs.getString('curr_subscribed_mess') ?? '';
      if (messId.isEmpty) {
        return;
      }
      final menus = await fetchMenu(messId, _weekdayName());
      if (!mounted) return;
      final now = DateTime.now();
      for (final MenuModel menu in menus) {
        final start = _parseMenuClock(menu.startTime);
        final end = _parseMenuClock(menu.endTime);
        final ongoing = (now.isAfter(start) || now.isAtSameMomentAs(start)) &&
            now.isBefore(end);
        if (ongoing) {
          return;
        }
      }
    } catch (_) {
    }
  }

  void _showMessScanRulesSheet() {
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
                      'Mess QR scan',
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
                    color: Color(0xFF676767),
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
                      for (var i = 0; i < _messScanRuleBodies.length; i++) ...[
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
                                _messScanRuleBodies[i],
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
    _mealCountdownTimer?.cancel();
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
              tooltip: 'Mess QR tips',
              onPressed: _showMessScanRulesSheet,
              icon: const Icon(Icons.info_outline),
              color: const Color(0xFF676767),
            ),
          ],
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
                    color: Color(0xFFE5E7EB),
                  ),
                ),
              )
            : !_cameraPermissionGranted
                ? _buildPermissionOverlay()
                : Stack(
                    children: [
                      ListView(
                        padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                        children: [
                          RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 32,
                                height: 48 / 32,
                                fontWeight: FontWeight.w500,
                              ),
                              children: [
                                TextSpan(
                                  text: 'Ready to Eat? ',
                                  style: TextStyle(color: _textPrimary),
                                ),
                                TextSpan(
                                  text: 'Scan to Enter',
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
                                    borderRadius: BorderRadius.circular(0),
                                    child: MobileScanner(
                                      controller: controller,
                                      onDetect: onBarcodeDetected,
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

  // NOTE: The UI is now the Figma white layout above; previous overlay UI removed.
}
