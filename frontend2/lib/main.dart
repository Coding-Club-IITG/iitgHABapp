import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:frontend2/apis/authentication/login.dart';
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/providers/feedback_provider.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/screens/login_screen.dart';
import 'package:frontend2/screens/mess_screen.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/utilities/startupitem.dart';
import 'package:frontend2/utilities/version_checker.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Check device type and app version on startup
  await VersionChecker.init();
  
  // Check if update is required
  final bool updateRequired = await VersionChecker.checkForUpdate();
  
  final bool asLoggedIn = await isLoggedIn();
  await Firebase.initializeApp();

  // initialize listeners & local notifications
  //await listenNotifications();

  // On iOS, wait a bit for AppDelegate to initialize and register for remote notifications
  if (Platform.isIOS) {
    await Future.delayed(const Duration(milliseconds: 1500));
  }

  // register token with backend (will also attach the refresh listener)
  await registerFcmToken();

  // Initialize Firebase Analytics
  await FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(true);

  HostelsNotifier.init();
  // Ensure prefs have latest isSetupDone from server before initializing provider
  if (asLoggedIn) {
    try {
      await fetchUserDetails();
      // After fetching user metadata, fetch the profile picture bytes (base64)
      // from the backend and cache it in SharedPreferences.
      try {
        await fetchUserProfilePicture();
      } catch (_) {
        // ignore failures here; provider/init or UI will fallback to default
      }
    } catch (_) {}
  }
  ProfilePictureProvider.init();

  await getUserMessInfo();

  // NotificationNotifier.init(); // No longer needed - handled by listenNotifications()

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => MessInfoProvider()),
        ChangeNotifierProvider(create: (_) => FeedbackProvider()),
      ],
      child: MyApp(isLoggedIn: asLoggedIn, updateRequired: updateRequired),
    ),
  );
}

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatefulWidget {
  final bool isLoggedIn;
  final bool updateRequired;

  const MyApp({super.key, required this.isLoggedIn, required this.updateRequired});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late Connectivity _connectivity;
  late Stream<ConnectivityResult> _connectivityStream;
  bool _isDialogShowing = false;

  @override
  void initState() {
    super.initState();

    isLoggedIn().then((asLoggedIn) => {if (asLoggedIn) registerFcmToken()});
    listenNotifications();
    setNavigatorKey(navigatorKey); // Set global navigator key for notifications

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Show update dialog if required
      if (widget.updateRequired) {
        VersionChecker.showUpdateDialog(navigatorKey.currentContext!);
        return; // Don't proceed with other initialization if update is required
      }
      
      // This ensures it runs after the first frame
      await context.read<MessInfoProvider>().fetchMessID();
    });

    _connectivity = Connectivity();

    // Use `.map()` to transform the stream into a stream of ConnectivityResult
    _connectivityStream = _connectivity.onConnectivityChanged.map(
        (List<ConnectivityResult> results) =>
            results.isNotEmpty ? results[0] : ConnectivityResult.none);

    _connectivityStream.listen((ConnectivityResult result) {
      _handleConnectivityChange(result);
    });
  }

  void _handleConnectivityChange(ConnectivityResult result) {
    if (result == ConnectivityResult.none) {
      _showNoInternetDialog();
    } else {
      if (_isDialogShowing) {
        Navigator.of(navigatorKey.currentContext!, rootNavigator: true).pop();
        _isDialogShowing = false;
      }
    }
  }

  void _showNoInternetDialog() {
    if (!_isDialogShowing) {
      _isDialogShowing = true;
      showDialog(
        context: navigatorKey.currentContext!,
        barrierDismissible: false, // Prevent dismissal by tapping outside
        builder: (BuildContext context) {
          return const AlertDialog(
            title: Text("No Internet Connection"),
            content: Text("Please check your internet connection."),
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.white,
        systemNavigationBarColor: Colors.black,
      ),
    );
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,

      home: widget.isLoggedIn
          ? const MainNavigationScreen()
          : const LoginScreen(),

      //home:  ProfileScreen(),
      builder: EasyLoading.init(),
      routes: {
        '/home': (context) => const MainNavigationScreen(),
        '/mess': (context) => const MessScreen(),
      },
    );
  }

  @override
  void dispose() {
    // Dispose of the connectivity stream if necessary
    super.dispose();
  }
}
