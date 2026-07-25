// Base API URL for the mess manager app.
const String baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://hab.codingclub.in/api',
);

// WebSockets URL
const String baseWsUrl = String.fromEnvironment(
  'API_WS_URL',
  defaultValue: 'wss://hab.codingclub.in/api',
);

class AuthEndpoints {
  static String get managerLogin => '$baseUrl/auth/manager/login';

  /// HABit HQ caterer Google sign-in (separate from RC manager password login).
  static String get catererGoogle => '$baseUrl/auth/caterer/google';
  static String get catererGuest => '$baseUrl/auth/caterer/guest';
  static String get catererRefresh => '$baseUrl/auth/caterer/refresh';
  static String get catererLogout => '$baseUrl/auth/caterer/logout';
}

class HostelEndpoints {
  static String get allHostels => '$baseUrl/hostel/all';
}

class GalaManagerEndpoints {
  static String get summary => '$baseUrl/gala/manager/summary';

  // WebSocket endpoint for live Gala scan logs (to be implemented server-side).
  static String wsUrl(String token) =>
      '$baseWsUrl/gala/manager/scan-logs?token=$token';
}

class MessManagerEndpoints {
  static String get todaySummary => '$baseUrl/logs/manager/today';
  static String get addOngoingScan => '$baseUrl/logs/manager/scan';
  static String get createScanEntry => '$baseUrl/logs/manager/entry';
  static String userProfile(String userId) => '$baseUrl/users/manager/$userId';
  static String userProfilePicture(String userId) =>
      '$baseUrl/profile/picture/manager/$userId';
  static String mealScanLogsWs(String meal, String token) =>
      '$baseWsUrl/mess/manager/scan-logs?meal=$meal&token=$token';
}

class ManagerUserEndpoints {
  static String get subscribers => '$baseUrl/users/manager/subscribers';
  static String subscriberTodayStatus(String userId) =>
      '$baseUrl/users/manager/subscribers/$userId/status';
}

class MessRebateManagerEndpoints {
  /// Mess manager view of mess-rebate leave applications (server/v1: /leave/hostel/mess-applications).
  static String get messApplications =>
      '$baseUrl/leave/hostel/mess-applications';

  /// Acknowledge a single rebate application as mess manager.
  static String acknowledge(String id) =>
      '$baseUrl/leave/hostel/applications/$id/acknowledge';

  /// Streams the file bytes via server-side OneDrive download (auth required).
  static String get download => '$baseUrl/leave/download';
}

class SummerMessManagerEndpoints {
  static String get applications => '$baseUrl/summer-mess/manager/applications';
  static String acknowledge(String id) =>
      '$baseUrl/summer-mess/manager/applications/$id/acknowledge';
  static String proofDocument(String id) =>
      '$baseUrl/summer-mess/manager/applications/$id/proof-document';
}

class HqAppVersionEndpoints {
  // HABit HQ (manager app) Android version info
  static String get getAndroidVersion => '$baseUrl/hq-app-version/android';
}
