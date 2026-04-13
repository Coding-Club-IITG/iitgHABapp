import 'dart:async';

import 'package:flutter/material.dart';
import 'package:frontend2/constants/app_ui_tokens.dart';

/// Live remaining time for an alert with [expiresAt] epoch milliseconds.
/// Renders nothing when expired or [expiresAt] is zero.
class AlertCountdownText extends StatefulWidget {
  const AlertCountdownText({
    super.key,
    required this.expiresAt,
  });

  final int expiresAt;

  @override
  State<AlertCountdownText> createState() => _AlertCountdownTextState();
}

class _AlertCountdownTextState extends State<AlertCountdownText> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  static String _formatRemaining(int diffMs) {
    final totalSec = diffMs ~/ 1000;
    final hours = totalSec ~/ 3600;
    final minutes = (totalSec % 3600) ~/ 60;
    final seconds = totalSec % 60;
    if (hours > 0) return '${hours}h ${minutes}m';
    if (minutes > 0) return '${minutes}m ${seconds}s';
    return '${seconds}s';
  }

  @override
  Widget build(BuildContext context) {
    if (widget.expiresAt <= 0) return const SizedBox.shrink();

    final now = DateTime.now().millisecondsSinceEpoch;
    final diff = widget.expiresAt - now;
    if (diff <= 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Text(
        _formatRemaining(diff),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppUi.yellow,
        ),
      ),
    );
  }
}
