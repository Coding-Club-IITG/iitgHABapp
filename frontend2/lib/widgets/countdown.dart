import 'dart:async';
import 'package:flutter/material.dart';

class CountdownText extends StatefulWidget {
  final int expiresAt;

  const CountdownText({
    super.key,
    required this.expiresAt
  });

  @override
  State<CountdownText> createState() => CountdownTextState();
}

class CountdownTextState extends State<CountdownText> {
  late Timer _timer;
  String _timeLeft = '';

  @override
  void initState() {
    super.initState();
    _updateTime();
    // Updates every 1 minute
    _timer = Timer.periodic(const Duration(minutes: 1), (_) => _updateTime());
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  void _updateTime() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final diff = widget.expiresAt - now;

    if (diff <= 0) {
      if (mounted) setState(() => _timeLeft = 'Expired');
      return;
    }

    final hours = diff ~/ (1000 * 60 * 60);
    final minutes = (diff ~/ (1000 * 60)) % 60;

    if (mounted) {
      setState(() {
        if (hours >= 24) {
          final days = hours ~/ 24;
          final remHours = hours % 24;
          _timeLeft = 'Expires in ${days}d ${remHours}h';
        } else {
          _timeLeft = 'Expires in ${hours}h ${minutes}m';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      _timeLeft,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: Color(0xFFD92D20), // A clean urgency red
      ),
    );
  }
}
