// Base API URL for the mess manager app.
// Point this at the same gateway the main app uses.
const String baseUrl = 'https://hab.codingclub.in/api';

class AuthEndpoints {
  static const String managerLogin = '$baseUrl/auth/manager/login';
}

class HostelEndpoints {
  static const String allHostels = '$baseUrl/hostel/all';
}

class GalaManagerEndpoints {
  static const String summary = '$baseUrl/gala/manager/summary';

  // WebSocket endpoint for live Gala scan logs (to be implemented server-side).
  static String wsUrl(String token) =>
      'wss://hab.codingclub.in/api/gala/manager/scan-logs?token=$token';
}

class MessManagerEndpoints {
  static const String todaySummary = '$baseUrl/logs/manager/today';
  static String userProfile(String userId) => '$baseUrl/users/manager/$userId';
  static String userProfilePicture(String userId) =>
      '$baseUrl/profile/picture/manager/$userId';
  static String mealScanLogsWs(String meal, String token) =>
      'wss://hab.codingclub.in/api/mess/manager/scan-logs?meal=$meal&token=$token';
}

class HqAppVersionEndpoints {
  // HABit HQ (manager app) Android version info
  static const String getAndroidVersion = '$baseUrl/hq-app-version/android';
}
