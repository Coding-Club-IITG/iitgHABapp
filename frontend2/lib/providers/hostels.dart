import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/mess_screen.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HostelsNotifier {
  static String userHostel = "";
  static var hostelNotifier = ValueNotifier<List<String>>([]);
  static var hostels = <String>[];
  static var hostelIdToNameMap = <String, String>{};
  /// Hostel ID -> whether laundry is available at that hostel.
  static var hostelIdToLaundry = <String, bool>{};
  static var onHostelChanged = <void Function()>[];

  static bool isLaundryAvailableForHostel(String? hostelId) {
    if (hostelId == null || hostelId.isEmpty) return false;
    return hostelIdToLaundry[hostelId] == true;
  }

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final dio = DioClient().dio;
      final response = await dio.get(
        '$baseUrl/hostel/all', // Match your backend route
      );
      hostels = [];
      hostelIdToNameMap = {};
      hostelIdToLaundry = {};
      for (Map hostel in response.data) {
        final hostelName = hostel['hostel_name'] as String;
        final hostelId = hostel['_id'] as String;
        hostels.add(hostelName);
        hostelIdToNameMap[hostelId] = hostelName;
        hostelIdToLaundry[hostelId] = hostel['isLaundryAvailable'] == true;
      }
      // Store the mapping in SharedPreferences for offline access
      final mapJson =
          hostelIdToNameMap.map((key, value) => MapEntry(key, value));
      await prefs.setString('hostelIdToNameMap', jsonEncode(mapJson));
      await prefs.setString(
        'hostelIdToLaundry',
        jsonEncode(hostelIdToLaundry.map((k, v) => MapEntry(k, v))),
      );
      // Update the cache in hostel_name.dart
      updateHostelIdCache(hostelIdToNameMap);
    } catch (e) {
      hostels = [
        'Barak',
        'Brahmaputra',
        'Dhansiri',
        'Dihing',
        'Disang',
        'Gaurang',
        'Kameng',
        'Kapili',
        'Lohit',
        'Manas',
        'Siang',
        'Subansiri',
        'Umiam',
      ];
      // Try to load cached mapping if API call fails
      try {
        final cachedMap = prefs.getString('hostelIdToNameMap');
        if (cachedMap != null) {
          final map = jsonDecode(cachedMap) as Map<String, dynamic>;
          hostelIdToNameMap =
              map.map((key, value) => MapEntry(key, value.toString()));
          updateHostelIdCache(hostelIdToNameMap);
        }
        final cachedLaundry = prefs.getString('hostelIdToLaundry');
        if (cachedLaundry != null) {
          final map = jsonDecode(cachedLaundry) as Map<String, dynamic>;
          hostelIdToLaundry =
              map.map((key, value) => MapEntry(key, value == true));
        }
      } catch (_) {
        // If cache is also unavailable, map will remain empty
      }
    } finally {
      hostelNotifier.value = hostels;

      prefs.setStringList("hostels", hostels);

      if (prefs.getString('hostelID') != null) {
        currSubscribedMess = calculateHostel(prefs.getString('hostelID') ?? "");
        if (hostels.contains(currSubscribedMess)) {
          userHostel = currSubscribedMess;
          prefs.setString("curr_subscribed_mess", currSubscribedMess);
        }
      } else {
        userHostel = hostels[0];
      }
      for (var onChange in onHostelChanged) {
        onChange();
      }
    }
  }

  // Registers a callback and invokes it immediately. Returns a function that
  // when called will deregister the callback. Example usage:
  // final remove = HostelsNotifier.addOnChange(() { ... });
  // remove(); // to deregister
  static VoidCallback addOnChange(void Function() func) {
    try {
      func();
    } catch (e, st) {
      // If the callback fails (for example, because the widget that added it
      // is no longer mounted), swallow the error here — callers should still
      // receive the callback registration and can remove it later.
      if (kDebugMode) debugPrint('HostelsNotifier.addOnChange initial call failed: $e');
      if (kDebugMode) debugPrint('$st');
    }
    onHostelChanged.add(func);
    return () {
      onHostelChanged.remove(func);
    };
  }
}
