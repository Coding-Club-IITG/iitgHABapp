import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/constants/endpoint.dart';
import '../../models/mess_menu_model.dart';

//cache so that it doesnt do api calls when state persists (only does it when app reopens)
final Map<String, List<MenuModel>> _menuCache = {};

const Duration kMenuCacheTtl = Duration(hours: 6);
String _menuCachePayloadKey(String key) => 'menu_cache_payload:$key';
String _menuCacheFetchedAtKey(String key) => 'menu_cache_fetched_at_ms:$key';

void seedMenuCache({
  required String messId,
  required String day,
  required List<dynamic> menuJson,
}) {
  final key = '$messId-$day';
  _menuCache[key] = menuJson
      .map((json) => MenuModel.fromJson(Map<String, dynamic>.from(json as Map)))
      .toList();
}

void seedMenuCacheWithModels({
  required String messId,
  required String day,
  required List<MenuModel> menus,
}) {
  final key = '$messId-$day';
  _menuCache[key] = menus;
}

Future<List<MenuModel>?> _loadPersistedMenuIfFresh(
  SharedPreferences prefs, {
  required String key,
}) async {
  try {
    final fetchedAtMs = prefs.getInt(_menuCacheFetchedAtKey(key));
    if (fetchedAtMs == null) return null;
    final age = DateTime.now()
        .difference(DateTime.fromMillisecondsSinceEpoch(fetchedAtMs));
    if (age > kMenuCacheTtl) return null;

    final raw = prefs.getString(_menuCachePayloadKey(key));
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! List) return null;
    final menus = decoded
        .map((e) => MenuModel.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    return menus;
  } catch (_) {
    return null;
  }
}

Future<List<MenuModel>> fetchMenu(String messId, String day) async {
  final startTime = DateTime.now();
  final key = '$messId-$day';

  // Return from cache if available
  if (_menuCache.containsKey(key)) {
    if (kDebugMode) debugPrint('✅ Returning cached menu for $key');

    final endTime = DateTime.now();
    final responseTime = endTime.difference(startTime).inMilliseconds;
    if (kDebugMode)
      debugPrint("⏱️ fetchMenu Response Time (from cache): $responseTime ms");

    return _menuCache[key]!;
  }

  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token') ?? '';

    // Try persisted menu cache before hitting network (speeds up app reopen).
    final persisted = await _loadPersistedMenuIfFresh(prefs, key: key);
    if (persisted != null) {
      _menuCache[key] = persisted;
      if (kDebugMode) debugPrint('✅ Returning persisted cached menu for $key');
      return persisted;
    }

    if (token.isEmpty) {
      throw Exception('⚠️ Access token not found');
    }

    if (kDebugMode)
      debugPrint('📤 Fetching menu for Mess ID: $messId, Day: $day');

    final response = await DioClient().dio.post(
      '$baseUrl/mess/menu/$messId',
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ),
      data: {'day': day},
    );

    if (response.statusCode == 200) {
      if (response.data is Map<String, dynamic> &&
          response.data['isMessClosed'] == true) {
        if (kDebugMode)
          debugPrint('Mess is closed for $key: ${response.data['message']}');

        _menuCache[key] = [];
        return [];
      }

      final List data = response.data;
      final menu =
          data.map<MenuModel>((json) => MenuModel.fromJson(json)).toList();
      _menuCache[key] = menu;
      try {
        await prefs.setString(_menuCachePayloadKey(key), jsonEncode(data));
        await prefs.setInt(
            _menuCacheFetchedAtKey(key), DateTime.now().millisecondsSinceEpoch);
      } catch (_) {}
      if (kDebugMode) debugPrint(response.data.toString());
      if (kDebugMode) debugPrint('✅ Menu fetched and cached for $key');

      final endTime = DateTime.now();
      final responseTime = endTime.difference(startTime).inMilliseconds;
      if (kDebugMode)
        debugPrint("⏱️ fetchMenu Response Time (from API): $responseTime ms");

      return menu;
    } else {
      throw Exception('❌ Server responded with status: ${response.statusCode}');
    }
  } on DioException catch (dioError) {
    if (kDebugMode) debugPrint('❌ DioException: ${dioError.toString()}');
    if (dioError.response != null) {
      if (kDebugMode) debugPrint('❌ Response Data: ${dioError.response?.data}');
    }
    throw Exception('Failed to fetch menu: ${dioError.toString()}');
  } catch (e) {
    if (kDebugMode) debugPrint('❌ Unexpected error: $e');
    throw Exception('Unexpected error while fetching menu');
  }
}
