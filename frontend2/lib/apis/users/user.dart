import 'dart:convert';

import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/apis/dio_client.dart';

/// Update the authenticated user's roomNumber and phoneNumber via server
/// Returns true on success, false otherwise.
Future<bool> saveUserProfileFields(
    {String? roomNumber, String? phoneNumber}) async {
  final header = await getAccessToken();
  if (header == 'error') {
    return false;
  }

  try {
    final body = <String, dynamic>{};
    // Always include fields, even if null/empty, so server can clear them
    body['roomNumber'] = roomNumber ?? '';
    body['phoneNumber'] = phoneNumber ?? '';

    final dio = DioClient().dio;
    final resp = await dio.post(
      UserEndpoints.saveUser,
      data: body,
      options: Options(
        headers: {
          'Authorization': 'Bearer $header',
          'Content-Type': 'application/json',
          'x-api-version': 'v1',
        },
      ),
    );
    if (resp.statusCode == 200) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
}

Future<Map<String, String>?> fetchUserDetails() async {
  final header = await getAccessToken();

  if (header == 'error') {
    throw ('token not found');
  }
  try {
    final dio = DioClient().dio;
    final resp = await dio.get(
      UserEndpoints.currentUser,
      options: Options(
        headers: {
          "Authorization": "Bearer $header",
          "Content-Type": "application/json",
        },
      ),
    );
    if (resp.statusCode == 200) {
      final prefs = await SharedPreferences.getInstance();
      final Map<String, dynamic> userData = resp.data;

      // Extract user details
      final String name = userData['name'] ?? "User";
      final String userId = userData['_id'] ?? "";
      final String? mail =
          userData['email']; // Can be null for Apple-only users
      final String roll = userData['rollNumber'] ?? "Not provided";
      // Handle null/undefined hostel and mess - use empty string for guest users
      final String currSubscribedMess = userData['curr_subscribed_mess'] != null
          ? userData['curr_subscribed_mess'].toString()
          : "";
      final String appliedMess =
          userData['applied_hostel_string'] ?? "Not provided";
      final String hostel =
          userData['hostel'] != null ? userData['hostel'].toString() : "";
      final bool gotHostel = userData['got_mess_changed'];
      final bool isSMC = userData['isSMC'] ?? false;
      final bool isSetupDone = userData['isSetupDone'] == true;
      final bool hasMicrosoftLinked = userData['hasMicrosoftLinked'] ?? false;
      final String? guestIdentifier =
          userData['guestIdentifier']; // Can be null for non-guest users
      final String roomNumber = (userData['roomNumber'] ?? '') as String;
      final String phoneNumber = (userData['phoneNumber'] ?? '') as String;

      prefs.setBool('isSMC', isSMC);
      prefs.setBool('gotMess', gotHostel);
      prefs.setBool('hasMicrosoftLinked', hasMicrosoftLinked);
      // Store guestIdentifier if it exists (for identifying guest users)
      if (guestIdentifier != null) {
        prefs.setString('guestIdentifier', guestIdentifier);
      } else {
        prefs.remove('guestIdentifier');
      }
      // Check if user is a guest user (has guestIdentifier and Microsoft not linked)
      final bool isGuest = guestIdentifier != null && !hasMicrosoftLinked;

      // Guest users skip the setup screen - automatically mark setup as done
      if (isGuest) {
        prefs.setBool("isSetupDone", true);
        ProfilePictureProvider.isSetupDone.value = true;
      } else {
        // For non-guest users, store the isSetupDone value from server
        prefs.setBool("isSetupDone", isSetupDone);
        ProfilePictureProvider.isSetupDone.value = isSetupDone;
      }

      // Only store email if it exists (null for Apple-only users without Microsoft linked)
      if (mail != null) {
        prefs.setString('email', mail);
      } else {
        prefs.remove('email'); // Remove if it was previously set
      }
      prefs.setString('rollNumber', roll);
      prefs.setString('appliedMess', appliedMess);
      prefs.setString('rollNo', roll);
      prefs.setString('hostel', hostel);
      prefs.setString('currMess', currSubscribedMess);
      prefs.setString('name', name);
      prefs.setString('userId', userId);
      await prefs.setString('roomNumber', roomNumber);
      await prefs.setString('phoneNumber', phoneNumber);
      // isSetupDone is already set above based on guest user check

      // Return the data as a map
      return {
        'name': name,
        'email': mail ?? '', // Provide empty string if null
        'roll': roll,
      };
    } else if (resp.statusCode == 401) {
      throw Exception('Unauthorized: Please log in again.');
    } else {
      throw Exception('Failed to fetch user details.');
    }
  } catch (e) {
    rethrow;
  }
}

/// Fetch the user's profile picture (base64) from the backend and persist it in SharedPreferences
/// Backend endpoint should return JSON like { "base64": "..." } or { "base64": "" } on failure/no-image
Future<void> fetchUserProfilePicture() async {
  final prefs = await SharedPreferences.getInstance();

  // If we already have a cached profile picture, use it and skip the network call.
  // This keeps app startup and navigation snappy; the cache is updated explicitly
  // after successful uploads or when this function is forced to run before cache exists.
  final cached = prefs.getString('profilePicture') ?? '';
  if (cached.isNotEmpty) {
    return;
  }

  final header = await getAccessToken();

  if (header == 'error') {
    // Not authenticated — clear any cached picture
    await prefs.setString('profilePicture', '');
    return;
  }

  try {
    final dio = DioClient().dio;
    final resp = await dio.get(
      ProfilePicture.getUserProfilePicture,
      options: Options(
        headers: {
          "Authorization": "Bearer $header",
          "Content-Type": "application/json",
        },
        responseType: ResponseType.bytes,
      ),
    );
    if (resp.statusCode == 200) {
      final contentType = resp.headers['content-type']?.toString() ?? '';
      if (contentType.contains('application/json')) {
        final Map<String, dynamic> data = resp.data is Map<String, dynamic>
            ? resp.data as Map<String, dynamic>
            : json.decode(utf8.decode(resp.data));
        if (data.containsKey('base64')) {
          final String b64 = (data['base64'] ?? '') as String;
          await prefs.setString('profilePicture', b64);
        } else if (data.containsKey('url')) {
          await prefs.setString('profilePicture', '');
        } else {
          await prefs.setString('profilePicture', '');
        }
      } else {
        final bytes = resp.data is List<int> ? resp.data as List<int> : <int>[];
        if (bytes.isNotEmpty) {
          final String b64 = base64Encode(bytes);
          await prefs.setString('profilePicture', b64);
        } else {
          await prefs.setString('profilePicture', '');
        }
      }
    } else {
      await prefs.setString('profilePicture', '');
    }
  } catch (e) {
    // Any error — clear cached picture so app shows default
    await prefs.setString('profilePicture', '');
  }
}

/// Delete user account
/// Returns void on success, throws exception on error
Future<void> deleteUserAccount() async {
  try {
    final token = await getAccessToken();
    if (token == 'error') {
      throw Exception('Not authenticated');
    }

    final dio = DioClient().dio;
    final response = await dio.delete(
      '$baseUrl/users/account',
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ),
    );

    if (response.statusCode == 200) {
      return; // Success
    } else {
      final message = response.data['message'] ?? 'Failed to delete account';
      final code = response.data['code'];

      if (code == 'PENDING_MESS_CHANGE') {
        throw Exception(
            'Cannot delete account with pending mess change application. '
            'Please wait for processing or contact admin.');
      } else if (code == 'SMC_MEMBER') {
        throw Exception(
            'SMC members cannot delete their accounts. Please contact admin.');
      }
      throw Exception(message);
    }
  } catch (e) {
    if (e is DioException) {
      final message = e.response?.data['message'] ?? 'Network error';
      throw Exception(message);
    }
    rethrow;
  }
}
