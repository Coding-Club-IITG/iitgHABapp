import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/constants/endpoint.dart';
import '../../models/mess_menu_model.dart';

//cache so that it doesnt do api calls when state persists (only does it when app reopens)
final Map<String, List<MenuModel>> _menuCache = {};

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
