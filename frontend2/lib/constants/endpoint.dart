const String baseUrl = "https://hab.codingclub.in/api";
const String authUrl = "https://hab.codingclub.in/api";

class MessRebateEndpoints {
  static const String sendApplication = '$baseUrl/leave/apply';
  static const String getApplications = '$baseUrl/leave/my-applications';
}

class NotificationEndpoints {
  static const String registerToken = '$baseUrl/notification/register-token';
  static const String welcome = '$baseUrl/notification/welcome';
}

class MessChange {
  static const String messChangeRequest = "$baseUrl/mess-change/reqchange";
  static const String messChangeStatus = "$baseUrl/mess-change/status";
}

class UserEndpoints {
  static const String currentUser = '$baseUrl/users/';
  static const String saveUser = '$baseUrl/users/save';
}

class ItemEndpoint {
  static const String getitem = '$baseUrl/items/';
}

class HostelEndpoint {
  static const String getitem = '$baseUrl/hostel/';
}

class AuthEndpoints {
  // For initial Microsoft login - redirects through backend
  static String get getAccess =>
      'https://login.microsoftonline.com/850aa78d-94e1-4bc6-9cf3-8c11b530701c/oauth2/v2.0/authorize?client_id=2cdac4f3-1fda-4348-a057-9bb2e3d184a1&response_type=code&redirect_uri=$authUrl/auth/login/redirect/mobile&scope=offline_access%20User.Read&state=12345&prompt=select_account';

  // For linking Microsoft account - uses same redirect URI as login but with state=link
  static String get linkMicrosoft =>
      'https://login.microsoftonline.com/850aa78d-94e1-4bc6-9cf3-8c11b530701c/oauth2/v2.0/authorize?client_id=2cdac4f3-1fda-4348-a057-9bb2e3d184a1&response_type=code&redirect_uri=$authUrl/auth/login/redirect/mobile&scope=offline_access%20User.Read&state=link&prompt=select_account';
}

class Userendpoints {
  static const getdetails = 'https://graph.microsoft.com/v1.0/me';
}

// Legacy token link removed - use `AuthEndpoints` or platform-specific config.

class MessFeedback {
  static const feedbackSubmit = "$baseUrl/feedback/submit";
  static const feedbackSubmitted = "$baseUrl/feedback/submitted";
  static const feedbackSettings = "$baseUrl/feedback/settings";
  static const windowTimeLeft = "$baseUrl/feedback/window-time-left";
}

class MessInfo {
  static const getMessInfo = "$baseUrl/mess/all";
  static const getUserMessInfo = "$baseUrl/mess/get";
}

class ProfilePicture {
  static const changeUserProfilePicture = "$baseUrl/profile/picture/set";
  static const getUserProfilePicture = "$baseUrl/profile/picture/get";
}

class AppVersionEndpoints {
  static const String getAndroidVersion = "$baseUrl/app-version/android";
  static const String getIosVersion = "$baseUrl/app-version/ios";
}

class GalaEndpoints {
  static const String upcoming = "$baseUrl/gala/upcoming";
  static String upcomingWithMenus(String hostelId) =>
      "$baseUrl/gala/upcoming-with-menus/$hostelId";
  static const String scanStatus = "$baseUrl/gala/scan-status";
  static const String scan = "$baseUrl/gala/scan";
}

class LaundryEndpoints {
  static const String status = "$baseUrl/laundry/status";
  static const String scan = "$baseUrl/laundry/scan";
}
