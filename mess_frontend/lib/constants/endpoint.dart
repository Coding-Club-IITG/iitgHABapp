// Base API URL for the mess manager app.
// Point this at the same gateway the main app uses.
const String baseUrl1 = 'https://hab.codingclub.in/api';
const String baseUrl = 'http://10.150.56.46:3000/api'; // For local testing with the server running on localhost

class AuthEndpoints {
  static const String managerLogin = 'http://10.150.56.46:3000/api/auth/manager/login';
}

class HostelEndpoints {
  static const String allHostels = '$baseUrl/hostel/all';
}

class LeaveEndpoints {
  static const String pendingApplications = '$baseUrl/leave/hostel/pending';
  static const String allApplications = '$baseUrl/leave/hostel/all';
  static const String rebateSummary = '$baseUrl/leave/hostel/rebate-summary';
  static const String downloadDocument = '$baseUrl/leave/download';

  static String approveApplication(String id) => '$baseUrl/leave/$id/approve';
  static String rejectApplication(String id) => '$baseUrl/leave/$id/reject';
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
