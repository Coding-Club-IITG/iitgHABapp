import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/constants/endpoint.dart';
import '../../models/mess_menu_model.dart';

//cache so that it doesnt do api calls when state persists (only does it when app reopens)
final Map<String, List<MenuModel>> _menuCache = {};

Future<List<MenuModel>> fetchMenu(String messId, String day) async {
  // final List data = jsonDecode("[{\"_id\":\"68b9455b5a52fa01d78d0eda\",\"messId\":\"689aa72d12652cd8381608b1\",\"day\":\"Thursday\",\"startTime\":\"07:00\",\"endTime\":\"09:00\",\"isGala\":false,\"type\":\"Breakfast\",\"items\":[{\"_id\":\"68b9457e5a52fa01d78d0ef3\",\"menuId\":\"68b9457e5a52fa01d78d0ef2\",\"name\":\"Idli\",\"type\":\"Dish\",\"likes\":[],\"__v\":0,\"isLiked\":false},{\"_id\":\"68b945915a52fa01d78d0f0b\",\"menuId\":\"68b945915a52fa01d78d0f0a\",\"name\":\"Bread\",\"type\":\"Breads and Rice\",\"likes\":[],\"__v\":0,\"isLiked\":false},{\"_id\":\"68b945915a52fa01d78d0f0b\",\"menuId\":\"68b945915a52fa01d78d0f0a\",\"name\":\"Bread\",\"type\":\"Breads and Rice\",\"likes\":[],\"__v\":0,\"isLiked\":false},{\"_id\":\"68b9459a5a52fa01d78d0f17\",\"menuId\":\"68b9459a5a52fa01d78d0f16\",\"name\":\"Milk\",\"type\":\"Others\",\"likes\":[],\"__v\":0,\"isLiked\":false}],\"__v\":4},{\"_id\":\"68b9455b5a52fa01d78d0edc\",\"messId\":\"689aa72d12652cd8381608b1\",\"day\":\"Thursday\",\"startTime\":\"12:15\",\"endTime\":\"14:00\",\"isGala\":false,\"type\":\"Lunch\",\"items\":[{\"_id\":\"68b945b45a52fa01d78d0f36\",\"menuId\":\"68b945b45a52fa01d78d0f35\",\"name\":\"Paneer Curry\",\"type\":\"Dish\",\"likes\":[],\"__v\":0,\"isLiked\":false},{\"_id\":\"68b945ba5a52fa01d78d0f42\",\"menuId\":\"68b945ba5a52fa01d78d0f41\",\"name\":\"Rice\",\"type\":\"Breads and Rice\",\"likes\":[],\"__v\":0,\"isLiked\":false},{\"_id\":\"68b945ce5a52fa01d78d0f4e\",\"menuId\":\"68b945ce5a52fa01d78d0f4d\",\"name\":\"Curd\",\"type\":\"Others\",\"likes\":[],\"__v\":0,\"isLiked\":false}],\"__v\":3},{\"_id\":\"68b9455b5a52fa01d78d0ede\",\"messId\":\"689aa72d12652cd8381608b1\",\"day\":\"Thursday\",\"startTime\":\"19:30\",\"endTime\":\"21:30\",\"isGala\":false,\"type\":\"Dinner\",\"items\":[{\"_id\":\"68b945dc5a52fa01d78d0f5a\",\"menuId\":\"68b945dc5a52fa01d78d0f59\",\"name\":\"Egg\",\"type\":\"Dish\",\"likes\":[],\"__v\":2,\"isLiked\":false},{\"_id\":\"68b945f55a52fa01d78d0f71\",\"menuId\":\"68b945f55a52fa01d78d0f70\",\"name\":\"Roti\",\"type\":\"Breads and Rice\",\"likes\":[\"689f029312652cd8381616ad\"],\"__v\":5,\"isLiked\":false},{\"_id\":\"68b945fd5a52fa01d78d0f7d\",\"menuId\":\"68b945fd5a52fa01d78d0f7c\",\"name\":\"Sweet\",\"type\":\"Others\",\"likes\":[],\"__v\":2,\"isLiked\":false}],\"__v\":3}]");
  // final menu = data.map<MenuModel>((json) => MenuModel.fromJson(json)).toList();
  // return menu;

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
