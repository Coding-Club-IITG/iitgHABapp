import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:flutter/foundation.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/models/mess_info_model.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';

Future<void> getUserMessInfo() async {
  try {
    if (kDebugMode) debugPrint('API calling getusermessinfo');
    final dio = DioClient().dio;
    final token = await getAccessToken();

    final response = await dio.post(
      MessInfo.getUserMessInfo,
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ),
    );
    if (kDebugMode) {
      debugPrint("response");
      debugPrint(response.toString());
    }
    if (response.statusCode == 200) {
      final prefs = await SharedPreferences.getInstance();

      final Map<String, dynamic> userData =
          response.data as Map<String, dynamic>;
      if (kDebugMode) debugPrint('user mess info is $userData');
      final String messID = userData['_id']?.toString() ?? "Not found";
      final String messName = userData['name']?.toString() ?? "Not found";
      final String hostelID = userData['hostelId']?.toString() ?? "Not found";
      final double rating = roundToTwoDecimals(userData['rating'] as num?);
      final int ranking = (userData['ranking'] as num?)?.toInt() ?? 0;
      final double feedbackPercentage =
          roundToTwoDecimals(userData['feedbackPercentage'] as num?);

      prefs.setString('messID', messID);
      prefs.setString('messName', messName);
      prefs.setString('hostelID', hostelID);
      prefs.setDouble('rating', rating);
      prefs.setInt('ranking', ranking);
      prefs.setDouble('feedbackPercentage', feedbackPercentage);
    }
  } catch (e) {
    if (kDebugMode) debugPrint('API Error in userMessInfo: $e');
  }
}
