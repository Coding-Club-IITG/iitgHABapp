import 'dart:async';

import 'package:flutter/material.dart';
import 'package:frontend2/utilities/alert_manager.dart';

class SilentAlertExpirer extends StatefulWidget {
  final int expiresAt;
  
  const SilentAlertExpirer({
    super.key,
    required this.expiresAt
  });

  @override
  State<SilentAlertExpirer> createState() => SilentAlertExpirerState();
}

class SilentAlertExpirerState extends State<SilentAlertExpirer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scheduleExpiry();
  }

  @override
  void didUpdateWidget(SilentAlertExpirer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.expiresAt != widget.expiresAt) {
      _scheduleExpiry();
    }
  }

  void _scheduleExpiry() {
    _timer?.cancel();
    final now = DateTime.now().millisecondsSinceEpoch;
    final diff = widget.expiresAt - now;

    if (diff <= 0) {
      // If it's somehow already expired, clean it up immediately
      WidgetsBinding.instance.addPostFrameCallback((_) {
        AlertsManager.filterAndLoadLocalAlerts();
      });
    } else {
      // Set a precise one-off timer to fire the exact millisecond it expires!
      _timer = Timer(Duration(milliseconds: diff), () {
        AlertsManager.filterAndLoadLocalAlerts();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // This widget is completely invisible and takes up 0 space in the UI
    return const SizedBox.shrink(); 
  }
}
