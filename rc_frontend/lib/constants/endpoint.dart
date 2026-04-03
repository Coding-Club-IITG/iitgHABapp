// Base API URL for the mess manager app.
// Point this at the same gateway the main app uses.
const String baseUrl = 'https://hab.codingclub.in/api';

class AuthEndpoints {
  static const String managerLogin = '$baseUrl/auth/manager/login';
}

class HostelEndpoints {
  static const String allHostels = '$baseUrl/hostel/all';
}

class HqAppVersionEndpoints {
  // HABit HQ (manager app) Android version info
  static const String getAndroidVersion = '$baseUrl/hq-app-version/android';
}

class RcAppVersionEndpoints {
  // HABit RC (room-cleaning manager app) Android version info
  static const String getAndroidVersion = '$baseUrl/rc-app-version/android';
}

class RcEndpoints {
  static const String tomorrow = '$baseUrl/room-cleaning/rc/tomorrow';
  static const String tomorrowAssign =
      '$baseUrl/room-cleaning/rc/tomorrow/assign';
  static const String finalizeStatuses =
      '$baseUrl/room-cleaning/rc/status/finalize';
}
