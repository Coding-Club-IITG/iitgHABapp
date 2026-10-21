import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:vibration/vibration.dart';

import 'package:frontend2/apis/events/events_api.dart';
import 'package:frontend2/constants/app_ui_tokens.dart';

/// Volunteer scanner: verifies attendee QRs one after another.
class EventScannerScreen extends StatefulWidget {
  const EventScannerScreen({
    super.key,
    required this.eventId,
    required this.eventTitle,
  });

  final String eventId;
  final String eventTitle;

  @override
  State<EventScannerScreen> createState() => _EventScannerScreenState();
}

class _EventScannerScreenState extends State<EventScannerScreen> {
  final EventsApi _api = EventsApi();
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
    autoStart: false,
  );

  bool _permissionGranted = false;
  bool _processing = false;
  CheckInResult? _result;
  int _admittedThisSession = 0;

  @override
  void initState() {
    super.initState();
    _ensurePermission();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _ensurePermission() async {
    var status = await Permission.camera.status;
    if (!status.isGranted) status = await Permission.camera.request();
    if (!mounted) return;
    setState(() => _permissionGranted = status.isGranted);
    if (status.isGranted) {
      try {
        await _controller.start();
      } catch (_) {}
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing || _result != null) return;
    final payload = capture.barcodes
        .map((b) => b.rawValue)
        .firstWhere((v) => v != null && v.isNotEmpty, orElse: () => null);
    if (payload == null) return;

    setState(() => _processing = true);
    await _controller.stop();
    final result = await _api.checkIn(widget.eventId, payload);
    if (!mounted) return;

    if (result.outcome == CheckInOutcome.allowed) {
      _admittedThisSession++;
      if (await Vibration.hasVibrator() == true) {
        Vibration.vibrate(duration: 100);
      }
    } else if (await Vibration.hasVibrator() == true) {
      Vibration.vibrate(pattern: [0, 120, 80, 120]);
    }
    if (!mounted) return;
    setState(() {
      _processing = false;
      _result = result;
    });
  }

  Future<void> _scanNext() async {
    setState(() => _result = null);
    try {
      await _controller.start();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.eventTitle, style: const TextStyle(fontSize: 16)),
            Text(
              'Admitted this session: $_admittedThisSession',
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
      ),
      body: !_permissionGranted
          ? _buildPermissionPrompt()
          : Stack(
              children: [
                MobileScanner(controller: _controller, onDetect: _onDetect),
                if (_result == null)
                  const Positioned(
                    bottom: 40,
                    left: 0,
                    right: 0,
                    child: Text(
                      "Scan the attendee's entry QR",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 16),
                    ),
                  ),
                if (_processing)
                  const ColoredBox(
                    color: Colors.black54,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (_result != null)
                  Align(
                    alignment: Alignment.bottomCenter,
                    child:
                        CheckInResultPanel(result: _result!, onNext: _scanNext),
                  ),
              ],
            ),
    );
  }

  Widget _buildPermissionPrompt() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.camera_alt_outlined,
                size: 64, color: AppUi.primary),
            const SizedBox(height: 16),
            const Text(
              'Camera access is needed to scan entry QRs.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: openAppSettings,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppUi.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Open Settings'),
            ),
          ],
        ),
      ),
    );
  }
}

class CheckInResultPanel extends StatelessWidget {
  const CheckInResultPanel(
      {super.key, required this.result, required this.onNext});

  final CheckInResult result;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final (Color color, IconData icon, String title) = switch (result.outcome) {
      CheckInOutcome.allowed => (
          const Color(0xFF1E7B34),
          Icons.check_circle,
          'Entry allowed'
        ),
      CheckInOutcome.alreadyEntered => (
          const Color(0xFFA36500),
          Icons.warning_amber_rounded,
          'Already entered'
        ),
      CheckInOutcome.denied => (
          const Color(0xFFB42318),
          Icons.cancel,
          'Entry denied'
        ),
    };
    final attendee = result.attendee;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 56),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(
                fontSize: 22, fontWeight: FontWeight.w700, color: color),
          ),
          if (result.outcome == CheckInOutcome.alreadyEntered &&
              result.checkedInAt != null)
            Text(
              'Scanned at ${DateFormat('h:mm a, d MMM').format(result.checkedInAt!)}',
              style: const TextStyle(color: AppUi.textSecondary),
            ),
          if (result.outcome == CheckInOutcome.denied)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                result.message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppUi.textSecondary),
              ),
            ),
          if (attendee != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppUi.primarySoft,
                  backgroundImage: attendee.profilePictureUrl != null
                      ? NetworkImage(attendee.profilePictureUrl!)
                      : null,
                  child: attendee.profilePictureUrl == null
                      ? const Icon(Icons.person, color: AppUi.primary)
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        attendee.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: AppUi.textPrimary,
                        ),
                      ),
                      if (attendee.rollNumber.isNotEmpty)
                        Text(attendee.rollNumber,
                            style: const TextStyle(color: AppUi.textSecondary)),
                      if (attendee.hostelName != null)
                        Text(attendee.hostelName!,
                            style: const TextStyle(color: AppUi.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onNext,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppUi.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text('Scan next'),
            ),
          ),
        ],
      ),
    );
  }
}
