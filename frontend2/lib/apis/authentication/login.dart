import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/main.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/utilities/notifications.dart';
// provider import removed (unused in this file)
import 'package:shared_preferences/shared_preferences.dart';

import '../../screens/login_screen.dart';

Future<void> authenticate() async {
  try {
    final result = await FlutterWebAuth2.authenticate(
        url: AuthEndpoints.getAccess, callbackUrlScheme: "iitghab");

    final uri = Uri.parse(result);

    final accessToken = uri.queryParameters['accessToken'];
    final refreshToken = uri.queryParameters['refreshToken'];

    if (accessToken == null || refreshToken == null) {
      throw ('Tokens not found');
    }

    final prefs = await SharedPreferences.getInstance();
    prefs.setString('access_token', accessToken);
    prefs.setString('refresh_token', refreshToken);

    // print
    if (kDebugMode) {
      print('Access Token: $accessToken');
      print('Refresh Token: $refreshToken');
    }

    await fetchUserDetails();
    await fetchUserProfilePicture();
    await getUserMessInfo();
    // await registerFcmToken();
    await HostelsNotifier.init();
    ProfilePictureProvider.init();
  } on PlatformException catch (_) {
    rethrow;
  } catch (e) {
    rethrow;
  }
}

/// Authenticate as guest user.
/// No credentials needed - backend handles guest login automatically.
/// Backward compatible: Old app versions may send email/password, but backend ignores them.
Future<void> guestAuthenticate() async {
  try {
    final dio = DioClient().dio;
    // Send empty body - backend will handle guest login automatically
    // Old app versions may send email/password, but backend accepts and ignores them
    final resp = await dio.post(
      '$baseUrl/auth/guest',
      data: {},
      options: Options(headers: {'Content-Type': 'application/json'}),
    );

    if (resp.statusCode != 200 ||
        resp.data == null ||
        resp.data['token'] == null) {
      throw ('Guest login failed');
    }

    final prefs = await SharedPreferences.getInstance();
    final accessToken = resp.data['accessToken'];
    final refreshToken = resp.data['refreshToken'];

    prefs.setString('access_token', accessToken);
    prefs.setString('refresh_token', refreshToken);

    // Reuse post-login initialization
    await fetchUserDetails();
    await getUserMessInfo();
    // await registerFcmToken();
    await HostelsNotifier.init();
    ProfilePictureProvider.init();
  } catch (e) {
    rethrow;
  }
}

Future<bool> refreshAccessToken() async {
  try {
    debugPrint('[refreshAccessToken] Called');
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString('refresh_token');

    debugPrint('[refreshAccessToken] Refresh token: '
        '${refreshToken != null ? refreshToken.substring(0, 8) + '...' : 'null'}');

    if (refreshToken == null) {
      debugPrint('[refreshAccessToken] No refresh token found');
      return false;
    }

    final dio = Dio();

    final response = await dio.post(
      '$baseUrl/auth/refresh',
      data: {
        "refreshToken": refreshToken,
      },
    );

    debugPrint('[refreshAccessToken] Response: '
        '${response.statusCode} ${response.data.toString()}');

    final newAccess = response.data['accessToken'];
    final newRefresh = response.data['refreshToken'];

    prefs.setString('access_token', newAccess);
    prefs.setString('refresh_token', newRefresh);

    debugPrint('[refreshAccessToken] Tokens updated');
    return true;
  } catch (e, stack) {
    debugPrint('[refreshAccessToken] Error: $e');
    debugPrint('[refreshAccessToken] Stack: $stack');
    return false;
  }
}

Future<void> logoutHandler(context) async {
  try {
    final dio = DioClient().dio;
    // Don't throw on non-2xx so we can handle 404s gracefully
    await dio.get('$baseUrl/auth/logout',
        options: Options(validateStatus: (status) => true));
  } catch (e) {
    // Server logout failed, continue with local logout
  }

  final prefs = await SharedPreferences.getInstance();
  await prefs.clear();
  // Use the global navigator if available; the dialog's build context may be
  // deactivated after calling Navigator.pop() in the dialog. This avoids the
  // "Looking up a deactivated widget's ancestor is unsafe" error.
  final navContext = navigatorKey.currentContext ?? context;
  if (navContext.mounted) {
    Navigator.of(navContext).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (context) => const LoginScreen(),
      ),
      (route) => false,
    );
  } else {
    // As a fallback, attempt push using the provided context (may still fail
    // if deactivated). We keep it inside try/catch to avoid crashing the app.
    try {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => const LoginScreen(),
        ),
        (route) => false,
      );
    } catch (e) {
      if (kDebugMode) debugPrint('Navigation to login failed: $e');
    }
  }
}

/// Sign in with Apple
Future<void> signInWithApple() async {
  try {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );

    // userIdentifier is always provided by Apple (even if email is hidden)
    if (credential.userIdentifier == null ||
        credential.userIdentifier!.isEmpty) {
      throw ('Unable to authenticate with Apple. Please try again.');
    }

    // Send to backend - email is optional, userIdentifier is required
    final dio = DioClient().dio;
    final response = await dio.post(
      '$baseUrl/auth/apple',
      data: {
        'identityToken': credential.identityToken,
        'authorizationCode': credential.authorizationCode,
        'userIdentifier': credential.userIdentifier,
        'email': credential.email, // Optional - only used if provided
        'name': '${credential.givenName ?? ''} ${credential.familyName ?? ''}'
            .trim(),
      },
      options: Options(headers: {'Content-Type': 'application/json'}),
    );

    final token = response.data['token'];
    final hasMicrosoftLinked = response.data['hasMicrosoftLinked'] ?? false;

    final prefs = await SharedPreferences.getInstance();
    prefs.setString('access_token', token);
    prefs.setBool('hasMicrosoftLinked', hasMicrosoftLinked);

    await fetchUserDetails();
    // Only fetch mess info if user has Microsoft linked (has roll number and mess subscription)
    if (hasMicrosoftLinked) {
      await getUserMessInfo();
    }
    // await registerFcmToken();
    await HostelsNotifier.init();
    ProfilePictureProvider.init();
  } on SignInWithAppleAuthorizationException catch (e) {
    // Error code 1000 often means simulator limitation or missing configuration
    if (e.code == AuthorizationErrorCode.unknown) {
      throw ('Sign in with Apple is not available. This may be due to simulator limitations. Please test on a real device or check your Apple Developer account configuration.');
    }
    rethrow;
  } catch (e) {
    rethrow;
  }
}

/// Link Microsoft account to existing Apple-authenticated user
Future<void> linkMicrosoftAccount() async {
  try {
    // Start Microsoft OAuth flow with direct app redirect to get code
    final result = await FlutterWebAuth2.authenticate(
      url: AuthEndpoints.linkMicrosoft,
      callbackUrlScheme: "iitghab",
    );

    // Parse the redirect URL - backend redirects to iitghab://link?code=...
    final uri = Uri.parse(result);
    final code = uri.queryParameters['code'];
    final error = uri.queryParameters['error'];

    if (error != null) {
      throw ('Error during Microsoft OAuth: $error');
    }

    if (code == null) {
      throw ('Authorization code not found in redirect URL');
    }

    // Send code to backend linking endpoint
    final token = await getAccessToken();
    if (token == 'error') throw ('Not authenticated');

    final dio = DioClient().dio;
    final response = await dio.post(
      '$baseUrl/auth/link-microsoft?code=$code',
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ),
    );

    // Update local state
    final prefs = await SharedPreferences.getInstance();
    prefs.setBool('hasMicrosoftLinked', true);

    // If accounts were merged, backend returns a new token - update it
    if (response.data['token'] != null) {
      prefs.setString('access_token', response.data['token']);
    }

    // Refresh user details to get updated name, roll number, hostel, etc.
    // This will update SharedPreferences with the latest user data
    await fetchUserDetails();
    await getUserMessInfo();

    // Re-register FCM token to subscribe to hostel/mess-specific topics
    // await registerFcmToken();

    // Trigger home screen refresh to update displayed name
    homeScreenRefreshNotifier.value = true;
  } catch (e) {
    rethrow;
  }
}

Future<bool> isLoggedIn() async {
  final access = await getAccessToken();

  if (access == 'error') return false;

  // Try using access token
  try {
    await fetchUserDetails(); // any protected API
    return true;
  } catch (e) {
    // Access expired → try refresh
    final refreshed = await refreshAccessToken();

    if (!refreshed) return false;

    return true;
  }
}
