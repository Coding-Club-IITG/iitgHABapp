import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
// removed unused imports: feedback_provider, complaints_screen, mess_feedback_page
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/screens/profile_screen.dart';
import 'package:frontend2/screens/qr_scanner.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/widgets/common/name_trimmer.dart';
import 'package:frontend2/widgets/mess_widgets/MessMenuBuilder.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utilities/startupitem.dart';
import '../widgets/alerts_card.dart';
import '../widgets/microsoft_required_dialog.dart';
import 'mess_preference.dart';
import 'room_cleaning/room_cleaning.dart';


class HomeScreen extends StatefulWidget {
  final void Function(int)? onNavigateToTab;
  final VoidCallback? onRefresh;
  const HomeScreen({super.key, this.onNavigateToTab, this.onRefresh});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String name = '';
  bool feedbackform = true;
  String currSubscribedMess = '';
  String? token;

  @override
  void initState() {
    super.initState();
    fetchUserData();
    fetchMessIdAndToken();
    // Listen for refresh requests (e.g., after linking account)
    homeScreenRefreshNotifier.addListener(_onRefreshRequested);
  }

  @override
  void dispose() {
    homeScreenRefreshNotifier.removeListener(_onRefreshRequested);
    super.dispose();
  }

  void _onRefreshRequested() {
    if (homeScreenRefreshNotifier.value) {
      fetchUserData();
      fetchMessIdAndToken();
      homeScreenRefreshNotifier.value = false; // Reset
    }
  }

  Future<void> fetchUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final name1 = prefs.getString('name');
    if (name1 != null) {
      setState(() {
        name = capitalizeWords(name1).split(' ').first;
      });
    }
  }

  String getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return "Good morning, ";
    } else if (hour < 18) {
      return "Good afternoon, ";
    } else {
      return "Good evening, ";
    }
  }

  Future<void> fetchMessIdAndToken() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      currSubscribedMess = prefs.getString('messID') ?? '';
      token = prefs.getString('access_token');
    });
  }

  // Add the missing getTodayDay method
  String getTodayDay() {
    final now = DateTime.now();
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];
    return days[now.weekday - 1];
  }

  Widget buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18.0),
      child: Row(
        children: [

          /// SCAN QR
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const QrScan()),
                );
              },
              child: _quickActionCard(
                iconPath: 'assets/icon/qrscan.svg',
                label: "Scan QR",
                iconData: null,
              ),
            ),
          ),

          const SizedBox(width: 12),
          /// ROOM CLEANING
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () async {
                final prefs = await SharedPreferences.getInstance();
                final hasMicrosoftLinked =
                    prefs.getBool('hasMicrosoftLinked') ?? false;

                if (!mounted) return;

                if (!hasMicrosoftLinked) {
                  showDialog(
                    context: context,
                    builder: (context) => const MicrosoftRequiredDialog(
                      featureName: 'Room Cleaning',
                    ),
                  );
                  return;
                }

                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const RoomCleaningScreen(),
                  ),
                );
              },
              child: _quickActionCard(
                iconPath: 'assets/icon/cleaning.svg',
                label: "Room Cleaning",
                iconData: Icons.cleaning_services_rounded,
              ),
            ),
          ),

          const SizedBox(width: 12),
          /// MESS CHANGE
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () async {
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

                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) =>
                    const MessChangePreferenceScreen(),
                  ),
                );
              },
              child: _quickActionCard(
                iconPath: 'assets/icon/messicon.svg',
                label: "Mess Change",
                iconData: null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickActionCard({
    required String iconPath,
    required String label,
    IconData? iconData,
  }) {
    return Container(
      height: 90,
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFF3754DB),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: iconData != null
                  ? Icon(
                      iconData,
                      size: 22,
                      color: Colors.white,
                    )
                  : SvgPicture.asset(
                      iconPath,
                      colorFilter: const ColorFilter.mode(
                        Colors.white,
                        BlendMode.srcIn,
                      ),
                      width: 22,
                      height: 22,
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }



  Widget buildMessTodayCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Text(
                "In Mess Today",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              GestureDetector(
                onTap: () => widget.onNavigateToTab?.call(1),
                child: const Text(
                  "Go to Mess",
                  style: TextStyle(
                    color: Color(0xFF3754DB),
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Consumer<MessInfoProvider>(
          builder: (context, messProvider, child) {
            // Fixed null safety issues
            if (messProvider.isLoading) {
              return const Card(
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.all(Radius.circular(24)),
                  side: BorderSide(color: Color(0xFFC5C5D1), width: 1),
                ),
                elevation: 0.5,
                child: Padding(
                  padding: EdgeInsets.all(18.0),
                  child: Center(child: CircularProgressIndicator()),
                ),
              );
            }

            final messId = currSubscribedMess;

            return MenuFutureBuilder(
              messId: messId,
              day: getTodayDay(),
            );
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    const usernameBlue = Color(0xFF3754DB);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: Padding(
          padding: const EdgeInsets.only(left: 15.0),
          child: InkWell(
            focusColor: Colors.transparent,
            hoverColor: Colors.transparent,
            splashColor: Colors.transparent,
            highlightColor: Colors.transparent,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ProfileScreen()),
              );
            },
            child: ValueListenableBuilder(
              valueListenable: ProfilePictureProvider.profilePictureString,
              builder: (context, value, child) {
                final String b64 = value;

                return CircleAvatar(
                  radius: 16,
                  // prefer transparent bg so default asset is visible
                  backgroundColor: Colors.transparent,
                  backgroundImage: b64.isNotEmpty
                      ? MemoryImage(base64Decode(b64))
                      : const AssetImage('assets/images/default_profile.png'),
                );
              },
            ),
          ),
        ),
        title: const SizedBox.shrink(),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16, top: 10),
            child: Image.asset(
              "assets/images/Handlogo.png",
              width: 36,
              height: 36,
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: 16.0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 13.5),
              RichText(
                text: TextSpan(
                  children: [
                    TextSpan(
                      text: getGreeting(),
                      style: const TextStyle(
                        fontFamily: 'OpenSans_regular',
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        color: Colors.black,
                      ),
                    ),
                    TextSpan(
                      text: name.isNotEmpty ? name : 'User',
                      style: const TextStyle(
                        fontFamily: 'OpenSans_bold',
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        color: usernameBlue,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                "No notifications need your attention",
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 24),
              AlertsCard(
                feedbackform: feedbackform,
              ),
              buildQuickActions(),
              // Only show "In Mess Today" if mess exists
              if (currSubscribedMess.isNotEmpty) buildMessTodayCard(),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
