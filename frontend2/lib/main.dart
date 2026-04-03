import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:frontend2/apis/authentication/login.dart' as auth;
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/providers/feedback_provider.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
import 'package:frontend2/screens/login_screen.dart';
import 'package:frontend2/screens/mess_screen.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/utilities/startupitem.dart';
import 'package:frontend2/utilities/version_checker.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Phase 1: run while native splash is visible (single logo screen)
  await VersionChecker.init();
  final updateRequired = await VersionChecker.checkForUpdate();
  final isLoggedIn = await auth.isLoggedIn();
  await ProfilePictureProvider.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => MessInfoProvider()),
        ChangeNotifierProvider(create: (_) => FeedbackProvider()),
        ChangeNotifierProvider(create: (_) => RoomCleaningProvider()),
      ],
      child: MyApp(isLoggedIn: isLoggedIn, updateRequired: updateRequired),
    ),
  );
}

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatefulWidget {
  final bool isLoggedIn;
  final bool updateRequired;

  const MyApp({
    super.key,
    required this.isLoggedIn,
    required this.updateRequired,
  });

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
    listenNotifications();
    setNavigatorKey(navigatorKey); // Set global navigator key for notifications
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
      home: widget.updateRequired
          ? const UpdateRequiredScreen()
          : (widget.isLoggedIn
              ? const MainNavigationScreen()
              : const LoginScreen()),
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

class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF0B1220),
              Color(0xFF0F172A),
            ],
          ),
        ),
        child: Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x1A000000),
                  blurRadius: 16,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Update Required',
                  style: TextStyle(
                    color: Color(0xFF2563EB),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  VersionChecker.updateMessage,
                  style: const TextStyle(
                    color: Color(0xFF1A1A2E),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(
                    onPressed: () => VersionChecker.openStore(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4C4EDB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Update',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}