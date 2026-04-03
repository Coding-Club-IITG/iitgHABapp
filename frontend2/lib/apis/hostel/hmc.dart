import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';

class HmcMember {
  final String name;
  final String email;
  final String phone;
  final String? photoAsset;

  HmcMember({
    required this.name,
    required this.email,
    required this.phone,
    this.photoAsset,
  });
}

class HmcRole {
  final String title;
  final List<HmcMember> members;

  HmcRole({required this.title, required this.members});
}

Future<List<HmcRole>> fetchHmcMembers() async {
  try {
    if (kDebugMode) debugPrint('API calling fetchHmcMembers');
    final dio = DioClient().dio;
    final token = await getAccessToken();

    final response = await dio.get(
      HmcEndpoints.getHmcMembers,
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
        },
      ),
    );

    if (kDebugMode) debugPrint('HMC response: ${response.data}');

    if (response.statusCode == 200) {
      final List<dynamic> members = response.data['hmcMembers'] ?? [];

      final Map<String, List<HmcMember>> groupedByType = {};

      for (final item in members) {
        final user = item['user'] as Map<String, dynamic>?;
        if (user == null) continue;

        final type = item['type'] as String? ?? 'Unknown';
        final member = HmcMember(
          name: user['name'] as String? ?? 'N/A',
          email: user['email'] as String? ?? '',
          phone: user['phoneNumber'] as String? ?? '',
          photoAsset: user['profilePictureUrl'] as String?,
        );

        groupedByType.putIfAbsent(type, () => []).add(member);
      }

      final List<HmcRole> roles = groupedByType.entries
          .map((e) => HmcRole(title: e.key, members: e.value))
          .toList();

      return roles;
    }
    return [];
  } catch (e) {
    if (kDebugMode) debugPrint('API Error in fetchHmcMembers: $e');
    rethrow;
  }
}
