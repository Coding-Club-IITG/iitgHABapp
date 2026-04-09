import 'dart:async';
import 'package:flutter/material.dart';
import '../utilities/alert_manager.dart';
import '../models/alert_model.dart';

class AlertsCard extends StatelessWidget {
  const AlertsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<AlertModel>>(
      valueListenable: AlertsManager.activeAlertsNotifier,
      builder: (context, activeAlerts, child) {
        if (activeAlerts.isEmpty) {
          return const SizedBox.shrink(); // Hide entirely if no active alerts
        }

        // We filter out alerts locally if the user has already completed the action
        final validAlerts = activeAlerts.where((alert) {
             // If you want to check local state (like hasAppliedForMessChange), you can do it here
             // bool hasApplied = Provider.of<UserProvider>(context).user.hasAppliedForMessChange;
             // if (alert.targetType == 'mess' && hasApplied) return false;
             return true; 
        }).toList();

        if (validAlerts.isEmpty) return const SizedBox.shrink();

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.red[50],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.red.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.warning_amber_outlined, color: Colors.red[800], size: 20),
                  const SizedBox(width: 8),
                  Text(
                    "Active Alerts",
                    style: TextStyle(
                      color: Colors.red[800],
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...validAlerts.map((alert) => _buildAlertItem(alert)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAlertItem(AlertModel alert) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            alert.title,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
          const SizedBox(height: 2),
          Text(
            alert.body,
            style: const TextStyle(fontSize: 14, color: Colors.black87),
          ),
          if (alert.hasCountdown) _CountdownText(expiresAt: alert.expiresAt),
        ],
      ),
    );
  }
}

class _CountdownText extends StatefulWidget {
  final int expiresAt;
  const _CountdownText({required this.expiresAt});

  @override
  State<_CountdownText> createState() => _CountdownTextState();
}

class _CountdownTextState extends State<_CountdownText> {
  late Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(minutes: 1), (timer) => setState(() {}));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final diff = widget.expiresAt - now;
    
    if (diff <= 0) return const SizedBox.shrink();

    final hours = diff ~/ (1000 * 60 * 60);
    final minutes = (diff % (1000 * 60 * 60)) ~/ (1000 * 60);

    return Padding(
      padding: const EdgeInsets.only(top: 4.0),
      child: Text(
        "Expires in ${hours}h ${minutes}m",
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.red[900]),
      ),
    );
  }
}
