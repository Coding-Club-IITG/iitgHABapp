import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/app_bootstrap.dart';
import 'package:frontend2/apis/mess/user_mess_info.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/screens/mess_preference.dart';
import 'package:frontend2/screens/account_screen.dart';
import 'package:frontend2/providers/notification_provider.dart';
import 'package:frontend2/widgets/common/bottom_nav_bar.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend2/providers/mess_info_provider.dart';
import 'home_screen.dart';
import 'mess_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _selectedIndex = 0;
  bool _navigationReady = false;
  bool _homeInitialDataReady = false;

  void _handleNavTap(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<NotificationProvider>().addListener(_onProviderChanged);
      }
    });
    _runPhase2AndPhase3();
  }

  /// Phase 2: fetch user details, mess info, profile picture (loader until done).
  /// Phase 3: FCM, hostels, analytics, mess list (background).
  Future<void> _runPhase2AndPhase3() async {
    final messInfoProvider = context.read<MessInfoProvider>();
    final roomCleaningProvider = context.read<RoomCleaningProvider>();

    bool bootstrapApplied = false;
    final bootstrapPayload = await fetchAppBootstrapData();
    if (bootstrapPayload != null) {
      bootstrapApplied = await applyAppBootstrapData(
        bootstrapPayload,
        messInfoProvider: messInfoProvider,
        roomCleaningProvider: roomCleaningProvider,
      );
    }

    if (bootstrapApplied) {
      _runPhase3Background(fromBootstrap: true);
      try {
        await fetchUserProfilePicture();
      } catch (_) {}
      if (mounted) setState(() => _navigationReady = true);
      return;
    }

    // Fallback: keep old behavior when bootstrap endpoint fails/unavailable.
    _runPhase3Background(fromBootstrap: false);
    try {
      await fetchUserDetails();
    } catch (_) {}
    try {
      await fetchUserProfilePicture();
    } catch (_) {}
    try {
      await getUserMessInfo();
    } catch (_) {}
    try {
      await globalNotificationProvider.syncAlerts();
    } catch (_) {}
    if (mounted) setState(() => _navigationReady = true);
  }

  void _runPhase3Background({required bool fromBootstrap}) {
    globalNotificationProvider.registerFcmToken();
    FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(true);
    if (!fromBootstrap) {
      HostelsNotifier.init();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context.read<MessInfoProvider>().fetchMessID();
      });
    }
  }

  void _onProviderChanged() {
    if (!mounted) return;
    final provider = globalNotificationProvider;
    final targetTab = provider.tabNavigation;
    if (targetTab != null && targetTab != _selectedIndex) {
      setState(() {
        _selectedIndex = targetTab;
      });
      provider.clearTabNavigation();
    }

    final screenName = provider.deepNavigation;
    if (screenName != null && mounted) {
      // Capture navigator before creating an async gap and wait briefly
      final navigator = Navigator.of(context);
      // Wait for tab navigation to complete
      Future.delayed(const Duration(milliseconds: 100), () {
        if (!mounted) return;

        switch (screenName) {
          case 'mess_change_screen':
            () async {
              final prefs = await SharedPreferences.getInstance();
              final hasMicrosoftLinked =
                  prefs.getBool('hasMicrosoftLinked') ?? false;
              if (!mounted) return;
              if (!hasMicrosoftLinked) {
                showDialog(
                  context: context,
                  builder: (context) => const MicrosoftRequiredDialog(
                    featureName: 'Mess Change',
                  ),
                );
                return;
              }
              navigator.push(
                MaterialPageRoute(
                  builder: (context) => const MessChangePreferenceScreen(),
                ),
              );
            }();
            break;
          case 'profile_screen':
            navigator.push(
              MaterialPageRoute(
                builder: (context) => const AccountScreen(),
              ),
            );
            break;
        }

        // Clear the navigation request
        provider.clearDeepNavigation();
      });
    }
  }

  @override
  @override
  void dispose() {
    globalNotificationProvider.removeListener(_onProviderChanged);
    super.dispose();
  }

  Widget _buildHomeLoadingOverlay() {
    return ShimmerHost(
      builder: (context, box) => Positioned.fill(
        child: Container(
          color: const Color(0xFFFCFCFC),
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            box(height: 30, width: 92),
                            const SizedBox(height: 8),
                            box(height: 18, width: 168),
                          ],
                        ),
                      ),
                      box(
                        height: 48,
                        width: 48,
                        borderRadius: BorderRadius.circular(24),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                          child: Column(
                            children: [
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: const Color(0xFFD2D2D2),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    box(
                                      height: 24,
                                      width: 24,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    const SizedBox(width: 8),
                                    box(height: 16, width: 90),
                                    const Spacer(),
                                    box(height: 16, width: 16),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(
                          width: double.infinity,
                          height: 8,
                          child: ColoredBox(color: Color(0xF2ECECEC)),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              box(height: 24, width: 132),
                              const SizedBox(height: 24),
                              Row(
                                children: [
                                  Expanded(
                                    child: Container(
                                      height: 148,
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: const Color(0xFFD2D2D2),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          box(
                                            height: 56,
                                            width: 56,
                                          ),
                                          const Spacer(),
                                          box(
                                            height: 16,
                                            width: 96,
                                          ),
                                          const SizedBox(height: 8),
                                          box(
                                            height: 18,
                                            width: 120,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Container(
                                      height: 148,
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: const Color(0xFFD2D2D2),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          box(
                                            height: 56,
                                            width: 56,
                                          ),
                                          const Spacer(),
                                          box(
                                            height: 16,
                                            width: 96,
                                          ),
                                          const SizedBox(height: 8),
                                          box(
                                            height: 18,
                                            width: 120,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(
                          width: double.infinity,
                          height: 8,
                          child: ColoredBox(color: Color(0xF2ECECEC)),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        box(
                                          height: 24,
                                          width: 56,
                                        ),
                                        const SizedBox(height: 6),
                                        box(
                                          height: 18,
                                          width: 104,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  box(height: 20, width: 86),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  box(height: 28, width: 110),
                                  const SizedBox(width: 8),
                                  box(height: 24, width: 84),
                                  const Spacer(),
                                  box(height: 20, width: 110),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: const Color(0xFFD2D2D2),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    box(height: 16, width: 48),
                                    const SizedBox(height: 12),
                                    box(height: 18),
                                    const SizedBox(height: 8),
                                    box(height: 18, width: 180),
                                    const SizedBox(height: 12),
                                    const Divider(
                                      height: 1,
                                      thickness: 1,
                                      color: Color(0xFFE6E6E6),
                                    ),
                                    const SizedBox(height: 20),
                                    IntrinsicHeight(
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                box(
                                                  height: 16,
                                                  width: 96,
                                                ),
                                                const SizedBox(height: 12),
                                                box(height: 18),
                                                const SizedBox(height: 8),
                                                box(
                                                  height: 18,
                                                  width: 120,
                                                ),
                                              ],
                                            ),
                                          ),
                                          Container(
                                            width: 1,
                                            margin: const EdgeInsets.symmetric(
                                              horizontal: 24,
                                            ),
                                            color: const Color(0xFFE6E6E6),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                box(
                                                  height: 16,
                                                  width: 60,
                                                ),
                                                const SizedBox(height: 12),
                                                box(height: 18),
                                                const SizedBox(height: 8),
                                                box(
                                                  height: 18,
                                                  width: 90,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
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

  @override
  Widget build(BuildContext context) {
    final loadingOverlayVisible = !_navigationReady || !_homeInitialDataReady;
    return Stack(
      children: [
        ValueListenableBuilder(
          valueListenable: ProfilePictureProvider.isSetupDone,
          builder: (context, setupDone, child) => Scaffold(
            body: (setupDone == true)
                ? (_navigationReady
                    ? IndexedStack(
                        index: _selectedIndex,
                        children: [
                          HomeScreen(
                            onNavigateToTab: _handleNavTap,
                            onInitialDataReady: () {
                              if (!_homeInitialDataReady && mounted) {
                                setState(() => _homeInitialDataReady = true);
                              }
                            },
                          ),
                          MessScreen(active: _selectedIndex == 1),
                        ],
                      )
                    : const SizedBox.shrink())
                : const InitialSetupScreen(),
            bottomNavigationBar: (setupDone == true && _navigationReady)
                ? BottomNavBar(
                    currentIndex: _selectedIndex,
                    onTap: _handleNavTap,
                  )
                : const SizedBox(),
          ),
        ),
        if (loadingOverlayVisible) _buildHomeLoadingOverlay(),
      ],
    );
  }
}
