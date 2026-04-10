// alert_manager.dart

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/alert_model.dart';
import '../apis/dio_client.dart';
import '../constants/endpoint.dart';

class AlertsManager {
  // UI listens to this to rebuild without Stateful widget boilerplate
  static final ValueNotifier<List<AlertModel>> activeAlertsNotifier = ValueNotifier([]);

  /// 1. App Open / Login Sync (Solves Reinstall Issue)
  static Future<void> syncAlerts() async {
    try {
      final dio = DioClient().dio;
      final response = await dio.get('$baseUrl/api/v2/alerts');
      if (response.statusCode == 200 && response.data['alerts'] != null) {
        final List<dynamic> alertsJson = response.data['alerts'];
        await _updateAndFilterAlerts(alertsJson.map((e) => AlertModel.fromJson(e)).toList());
      }
    } catch (e) {
      if (kDebugMode) debugPrint("Error syncing alerts: $e");
      await filterAndLoadLocalAlerts(); // Fallback to local cache
    }
  }

  /// 2. The Filter Loop (Run on every App Foreground / Resume)
  static Future<void> filterAndLoadLocalAlerts() async {
    final prefs = await SharedPreferences.getInstance();
    final alertsString = prefs.getString('alerts');
    if (alertsString != null) {
      final List<dynamic> decoded = jsonDecode(alertsString);
      final alerts = decoded.map((e) => AlertModel.fromJson(e)).toList();
      await _updateAndFilterAlerts(alerts);
    }
  }

  /// 3. Incoming FCM Handler
  static Future<void> addAlertFromFCM(Map<String, dynamic> data) async {
    if (data['alert'] == "true") {
      final newAlert = AlertModel.fromJson(data);
      
      final prefs = await SharedPreferences.getInstance();
      final alertsString = prefs.getString('alerts');
      List<AlertModel> currentAlerts = [];
      
      if (alertsString != null) {
        final List<dynamic> decoded = jsonDecode(alertsString);
        currentAlerts = decoded.map((e) => AlertModel.fromJson(e)).toList();
      }
      
      currentAlerts.add(newAlert);
      await _updateAndFilterAlerts(currentAlerts);
    }
  }

  /// Call this when the user logs out
  static Future<void> clearAlerts() async {
    activeAlertsNotifier.value = []; // Instantly clear the UI
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('alerts'); // Wipe the local cache
  }

  /// Core logic: Drop expired -> Deduplicate -> Preserve Read Status -> Sort -> Notify UI
  static Future<void> _updateAndFilterAlerts(List<AlertModel> incomingAlerts) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    
    // 1. Grab local alerts first so we remember what was already read
    final prefs = await SharedPreferences.getInstance();
    final alertsString = prefs.getString('alerts');
    final Map<String, bool> readStatusMap = {};
    
    if (alertsString != null) {
      final List<dynamic> decoded = jsonDecode(alertsString);
      for (var e in decoded) {
        final localAlert = AlertModel.fromJson(e);
        readStatusMap[localAlert.id] = localAlert.isRead;
      }
    }

    // 2. Drop expired
    final activeAlerts = incomingAlerts.where((a) => a.expiresAt > now).toList();
    
    // 3. Deduplicate using ID and apply preserved read status
    final Map<String, AlertModel> uniqueAlerts = {};
    for (var a in activeAlerts) {
      final previouslyRead = readStatusMap[a.id] ?? a.isRead;
      uniqueAlerts[a.id] = a.copyWith(isRead: previouslyRead);
    }
    
    // 4. Sort (Ending soonest first)
    final finalAlerts = uniqueAlerts.values.toList()
      ..sort((a, b) => a.expiresAt.compareTo(b.expiresAt));

    // Update UI instantly and persist
    activeAlertsNotifier.value = finalAlerts;
    await prefs.setString('alerts', jsonEncode(finalAlerts.map((e) => e.toJson()).toList()));
  }

  /// Called when the Updates card is tapped!
  static Future<void> markAllAlertsAsRead() async {
    final currentAlerts = activeAlertsNotifier.value;
    if (currentAlerts.isEmpty) return;

    final updatedAlerts = currentAlerts.map((a) => a.copyWith(isRead: true)).toList();
    activeAlertsNotifier.value = updatedAlerts;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('alerts', jsonEncode(updatedAlerts.map((e) => e.toJson()).toList()));
  }
}
