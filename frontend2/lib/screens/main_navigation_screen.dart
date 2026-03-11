import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/screens/gala_dinner_screen.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/screens/mess_preference.dart';
import 'package:frontend2/screens/profile_screen.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/widgets/common/bottom_nav_bar.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/utilities/startupitem.dart';
import 'home_screen.dart';
import 'mess_screen.dart';

final _dio = DioClient().dio;

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _selectedIndex = 0;
  bool _showGalaTab = false;
  bool _homeDataReady = false;

  void _handleNavTap(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  void initState() {
    super.initState();
    _resolveGalaTabVisibility();
    tabNavigationNotifier.addListener(_onTabNavigationRequested);
    deepNavigationNotifier.addListener(_onDeepNavigationRequested);
    _runPhase2AndPhase3();
  }

  /// Phase 2: fetch user details, mess info, profile picture (loader until done).
  /// Phase 3: FCM, hostels, analytics, mess list (background).
  Future<void> _runPhase2AndPhase3() async {
    // Phase 3 (background) – start immediately, don't block
    _runPhase3Background();

    // Phase 2 – must complete before hiding home loader
    try {
      await fetchUserDetails();
    } catch (_) {}
    try {
      await fetchUserProfilePicture();
    } catch (_) {}
    try {
      await getUserMessInfo();
    } catch (_) {}
    if (mounted) setState(() => _homeDataReady = true);
  }

  void _runPhase3Background() {
    registerFcmToken();
    FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(true);
    HostelsNotifier.init();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<MessInfoProvider>().fetchMessID();
    });
  }

  /// Gala tab: for SMC show when any upcoming gala; for non-SMC show only when
  /// gala date is within 3 days (visible from galaDate-2 days through gala date).
  Future<void> _resolveGalaTabVisibility() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final isSMC = prefs.getBool('isSMC') ?? false;
      final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;

      // Only users who have linked their Microsoft (student) account
      // should see the Gala tab at all.
      if (!hasMicrosoftLinked) {
        if (mounted) {
          setState(() => _showGalaTab = false);
        }
        return;
      }

      final response = await _dio.get(GalaEndpoints.upcoming);
      final galaData = response.data;
      final galaDateRaw = galaData is Map ? galaData['date'] : null;
      if (galaDateRaw == null) {
        if (mounted) setState(() => _showGalaTab = false);
        return;
      }
      DateTime? galaDate;
      if (galaDateRaw is String) {
        galaDate = DateTime.tryParse(galaDateRaw)?.toLocal();
      } else if (galaDateRaw is DateTime) {
        galaDate = galaDateRaw.toLocal();
      }
      if (galaDate == null) {
        if (mounted) setState(() => _showGalaTab = false);
        return;
      }
      final galaDay = DateTime(galaDate.year, galaDate.month, galaDate.day);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final daysUntil = galaDay.difference(today).inDays;
      // Non-SMC: show only when 0 <= daysUntil <= 2 (i.e. within 3 days: today, tomorrow, day after)
      final show = isSMC ? (daysUntil >= 0) : (daysUntil >= 0 && daysUntil <= 2);
      if (mounted) {
        setState(() {
          _showGalaTab = show;
          if (!show && _selectedIndex == 2) _selectedIndex = 0;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _showGalaTab = false);
    }
  }

  void _onTabNavigationRequested() {
    final targetTab = tabNavigationNotifier.value;
    if (targetTab != null && targetTab != _selectedIndex) {
      setState(() {
        _selectedIndex = targetTab;
      });
      // Clear the navigation request
      tabNavigationNotifier.value = null;
    }
  }

  void _onDeepNavigationRequested() {
    final screenName = deepNavigationNotifier.value;
    if (screenName != null && mounted) {
      // Capture navigator before creating an async gap and wait briefly
      final navigator = Navigator.of(context);
      // Wait for tab navigation to complete
      Future.delayed(const Duration(milliseconds: 100), () {
        if (!mounted) return;

        switch (screenName) {
          case 'mess_change_screen':
            navigator.push(
              MaterialPageRoute(
                builder: (context) => const MessChangePreferenceScreen(),
              ),
            );
            break;
          case 'profile_screen':
            navigator.push(
              MaterialPageRoute(
                builder: (context) => const ProfileScreen(),
              ),
            );
            break;
        }

        // Clear the navigation request
        deepNavigationNotifier.value = null;
      });
    }
  }

  @override
  void dispose() {
    tabNavigationNotifier.removeListener(_onTabNavigationRequested);
    deepNavigationNotifier.removeListener(_onDeepNavigationRequested);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(onNavigateToTab: _handleNavTap),
      const MessScreen(),
      const GalaDinnerScreen(),
    ];
    return Stack(
      children: [
        ValueListenableBuilder(
          valueListenable: ProfilePictureProvider.isSetupDone,
          builder: (context, setupDone, child) => Scaffold(
            body: (setupDone == true)
                ? IndexedStack(
                    index: _selectedIndex,
                    children: screens,
                  )
                : const InitialSetupScreen(),
            bottomNavigationBar: (setupDone == true)
                ? BottomNavBar(
                    currentIndex: _selectedIndex,
                    onTap: _handleNavTap,
                    showGalaTab: _showGalaTab,
                  )
                : const SizedBox(),
          ),
        ),
        if (!_homeDataReady)
          Positioned.fill(
            child: Container(
              color: Colors.white,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text(
                      'Loading...',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF676767),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
