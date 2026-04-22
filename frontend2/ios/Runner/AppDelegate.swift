import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let configChannelName = "in.codingclub.hab/config"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    if let controller = window?.rootViewController as? FlutterViewController {
      let configChannel = FlutterMethodChannel(
        name: configChannelName,
        binaryMessenger: controller.binaryMessenger
      )
      configChannel.setMethodCallHandler { [weak self] call, result in
        guard let self else {
          result(FlutterError(code: "UNAVAILABLE", message: "AppDelegate unavailable", details: nil))
          return
        }
        self.handleConfigChannel(call: call, result: result)
      }
    }
    
    // Request notification permissions and register for remote notifications
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self
      let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
      UNUserNotificationCenter.current().requestAuthorization(
        options: authOptions,
        completionHandler: { _, _ in }
      )
    } else {
      let settings: UIUserNotificationSettings =
        UIUserNotificationSettings(types: [.alert, .badge, .sound], categories: nil)
      application.registerUserNotificationSettings(settings)
    }
    
    // Register for remote notifications
    application.registerForRemoteNotifications()
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func handleConfigChannel(call: FlutterMethodCall, result: FlutterResult) {
    switch call.method {
    case "getOpenWeatherApiKey":
      let key = Bundle.main.object(forInfoDictionaryKey: "OPENWEATHER_API_KEY") as? String
      result((key ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
    default:
      result(FlutterMethodNotImplemented)
    }
  }
  
  // Handle successful APNS registration
  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Pass device token to Firebase Messaging
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }
  
  // Handle APNS registration failure
  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
}

