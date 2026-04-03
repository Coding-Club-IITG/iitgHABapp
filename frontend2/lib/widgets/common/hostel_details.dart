import 'package:dio/dio.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'dart:convert';

// Function to fetch hostel data
Future<Map<String, dynamic>> fetchHostelData(
    String hostelName, String rollNumber) async {
  final jwtToken = await getAccessToken(); // Retrieve the JWT token
  final String url = '$baseUrl/hostel/hostel/$hostelName/user/$rollNumber';

  try {
    final dio = DioClient().dio;
    final response = await dio.get(
      url,
      options: Options(headers: {
        'Authorization': 'Bearer $jwtToken',
        'Content-Type': 'application/json',
      }),
    );
    if (response.statusCode != null && response.statusCode! == 200) {
      return response.data as Map<String, dynamic>;
    } else {
      throw Exception(
          'Failed to fetch data. Status code: \\${response.statusCode}\\nResponse: \\${response.data}');
    }
  } catch (e) {
    throw Exception('Error occurred: $e');
  }
}
