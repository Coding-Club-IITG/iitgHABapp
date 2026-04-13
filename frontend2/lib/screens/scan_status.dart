import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/services/festival_mode_service.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
import 'package:frontend2/screens/leave_application_list_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract final class _ScanUi {
  // Core tokens (aligned with Figma + existing app usage)
  static const Color white = Color(0xFFFFFFFF);
  static const Color primary = Color(0xFF4C4EDB);
  static const Color greyBg = Color(0xFFF5F5F5);
  static const Color border = Color(0xFFE6E6E6);
  static const Color textPrimary = Color(0xFF2E2F31);
  static const Color textSecondary = Color(0xFF535353);

  // Semantic
  static const Color green = Color(0xFF1F8441);
  static const Color green0 = Color(0xFFEDF7F2);
  static const Color green1 = Color(0xFFE2F2EB);

  static const Color yellow = Color(0xFFA36500);
  static const Color yellow0 = Color(0xFFFFFAEB);
  static const Color yellow1 = Color(0xFFFEF0C7);
  static const Color yellowBanner = Color(0xFFF9ECD2);
  static const Color yellowBannerText = Color(0xFF8A5500);

  static const Color red = Color(0xFFC40205);
  static const Color red0 = Color(0xFFFEF6F6);
  static const Color red1 = Color(0xFFFCF0F0);
}

class ScanStatusPage extends StatefulWidget {
  final Response response;
  const ScanStatusPage({
    super.key,
    required this.response,
  });

  @override
  State<ScanStatusPage> createState() => _ScanStatusPageState();
}

class _ScanStatusPageState extends State<ScanStatusPage> {
  String profilePicture = '';

  @override
  void initState() {
    super.initState();
    _loadProfilePicture();
  }

  Future<void> _loadProfilePicture() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() => profilePicture = prefs.getString('profilePicture') ?? '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _ScanUi.white,
      body: SafeArea(
        child: _buildStatusContent(context),
      ),
    );
  }

  Widget _buildStatusContent(BuildContext context) {
    final statusCode = widget.response.statusCode ?? 500;
    final data = widget.response.data as Map<String, dynamic>? ?? {};

    if (kDebugMode) debugPrint(data['message']?.toString());
    if (kDebugMode) debugPrint(statusCode.toString());

    final bool success = data['success'] == true;
    if (statusCode == 200 && success) {
      return _SuccessView(
        profilePictureBase64: profilePicture,
        mealType: (data['mealType'] ?? 'Meal').toString(),
        userName: (data['user']?['name'] ?? 'User').toString(),
        time: (data['time'] ?? _getCurrentTime()).toString(),
        date: (data['date'] ?? _getCurrentDate()).toString(),
        onGoHome: () => _goHome(context),
      );
    } else if (statusCode == 200 &&
        data['message']?.toString().contains('Already') == true) {
      return _AlreadyLoggedView(
        time: (data['time'] ?? _getCurrentTime()).toString(),
        onGoHome: () => _goHome(context),
      );
    } else {
      final message = (data['message'] ?? '').toString();
      final isRebateActive = (statusCode == 404 || statusCode == 403) &&
          message.trim() == 'Mess Rebate Active';
      return _FailedView(
        showRebateBanner: isRebateActive,
        onGoHome: () => _goHome(context),
        onTryAgain: () => Navigator.of(context).maybePop(),
        onOpenRebate: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
              builder: (_) => const LeaveApplicationListScreen()),
        ),
      );
    }
  }

  Future<void> _goHome(BuildContext context) async {
    await FestivalModeService().bootstrapBeforeHome();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const MainNavigationScreen()),
      (Route<dynamic> route) => false,
    );
  }

  String _getCurrentTime() {
    final now = DateTime.now();
    final hour =
        now.hour > 12 ? now.hour - 12 : (now.hour == 0 ? 12 : now.hour);
    final minute = now.minute.toString().padLeft(2, '0');
    final period = now.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  String _getCurrentDate() {
    final now = DateTime.now();
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${now.day} ${months[now.month - 1]} ${now.year}';
  }
}

class _FeaturedIcon extends StatelessWidget {
  const _FeaturedIcon({
    required this.bg,
    required this.ring,
    required this.icon,
    required this.iconColor,
  });

  final Color bg;
  final Color ring;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      height: 96,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6969),
        border: Border.all(color: ring, width: 17.143),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 48, color: iconColor),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: _ScanUi.greyBg,
        border: Border(top: BorderSide(color: _ScanUi.border)),
      ),
      padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + bottom),
      child: child,
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({
    required this.profilePictureBase64,
    required this.mealType,
    required this.userName,
    required this.time,
    required this.date,
    required this.onGoHome,
  });

  final String profilePictureBase64;
  final String mealType;
  final String userName;
  final String time;
  final String date;
  final VoidCallback onGoHome;

  ImageProvider _avatarProvider() {
    if (profilePictureBase64.isEmpty) {
      return const AssetImage('assets/images/default_profile.png');
    }
    return MemoryImage(base64Decode(profilePictureBase64));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 160),
        const _FeaturedIcon(
          bg: _ScanUi.green1,
          ring: _ScanUi.green0,
          icon: Icons.check_circle_outline_rounded,
          iconColor: _ScanUi.green,
        ),
        const SizedBox(height: 16),
        const Text(
          'Scan Successful!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 24,
            height: 32 / 24,
            fontWeight: FontWeight.w500,
            color: _ScanUi.green,
          ),
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 308),
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                decoration: BoxDecoration(
                  color: _ScanUi.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _ScanUi.border),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 86,
                      height: 86,
                      decoration: const BoxDecoration(
                        color: _ScanUi.red0,
                        shape: BoxShape.circle,
                      ),
                      padding: const EdgeInsets.all(2),
                      child: ClipOval(
                        child: Image(
                          image: _avatarProvider(),
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      userName,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 20,
                        height: 28 / 20,
                        fontWeight: FontWeight.w500,
                        color: _ScanUi.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Divider(
                        height: 1, thickness: 1, color: _ScanUi.border),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Meal',
                          style: TextStyle(
                            fontSize: 14,
                            height: 20 / 14,
                            fontWeight: FontWeight.w500,
                            color: _ScanUi.textSecondary,
                          ),
                        ),
                        Text(
                          mealType,
                          style: const TextStyle(
                            fontSize: 16,
                            height: 20 / 16,
                            fontWeight: FontWeight.w500,
                            color: _ScanUi.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Time & Date',
                          style: TextStyle(
                            fontSize: 14,
                            height: 20 / 14,
                            fontWeight: FontWeight.w500,
                            color: _ScanUi.textSecondary,
                          ),
                        ),
                        Text(
                          '$time,\n$date',
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontSize: 16,
                            height: 20 / 16,
                            fontWeight: FontWeight.w500,
                            color: _ScanUi.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        _BottomBar(
          child: SizedBox(
            height: 52,
            width: double.infinity,
            child: FilledButton(
              onPressed: onGoHome,
              style: FilledButton.styleFrom(
                backgroundColor: _ScanUi.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Go Home',
                style: TextStyle(
                  fontSize: 16,
                  height: 24 / 16,
                  fontWeight: FontWeight.w500,
                  color: _ScanUi.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _AlreadyLoggedView extends StatelessWidget {
  const _AlreadyLoggedView({
    required this.time,
    required this.onGoHome,
  });

  final String time;
  final VoidCallback onGoHome;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 160),
        const _FeaturedIcon(
          bg: _ScanUi.yellow1,
          ring: _ScanUi.yellow0,
          icon: Icons.warning_amber_rounded,
          iconColor: _ScanUi.yellow,
        ),
        const SizedBox(height: 24),
        const Text(
          'Entry Already Logged!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 24,
            height: 32 / 24,
            fontWeight: FontWeight.w500,
            color: _ScanUi.yellow,
          ),
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _ScanUi.yellowBanner,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                const Text(
                  'You have already entered at',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    height: 20 / 16,
                    fontWeight: FontWeight.w500,
                    color: _ScanUi.yellowBannerText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  time,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 20 / 16,
                    fontWeight: FontWeight.w500,
                    color: _ScanUi.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        _BottomBar(
          child: SizedBox(
            height: 52,
            width: double.infinity,
            child: FilledButton(
              onPressed: onGoHome,
              style: FilledButton.styleFrom(
                backgroundColor: _ScanUi.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Go Home',
                style: TextStyle(
                  fontSize: 16,
                  height: 24 / 16,
                  fontWeight: FontWeight.w500,
                  color: _ScanUi.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _FailedView extends StatelessWidget {
  const _FailedView({
    required this.showRebateBanner,
    required this.onGoHome,
    required this.onTryAgain,
    required this.onOpenRebate,
  });

  final bool showRebateBanner;
  final VoidCallback onGoHome;
  final VoidCallback onTryAgain;
  final VoidCallback onOpenRebate;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 160),
        const _FeaturedIcon(
          bg: _ScanUi.red1,
          ring: _ScanUi.red0,
          icon: Icons.error_outline_rounded,
          iconColor: _ScanUi.red,
        ),
        const SizedBox(height: 24),
        const Text(
          'Scan Failed!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 24,
            height: 32 / 24,
            fontWeight: FontWeight.w500,
            color: _ScanUi.red,
          ),
        ),
        const Spacer(),
        if (showRebateBanner) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _RebateActiveBanner(onTapArrow: onOpenRebate),
          ),
          const SizedBox(height: 20),
        ],
        _BottomBar(
          child: Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 54,
                  child: OutlinedButton(
                    onPressed: onGoHome,
                    style: OutlinedButton.styleFrom(
                      backgroundColor: _ScanUi.white,
                      foregroundColor: _ScanUi.primary,
                      side: const BorderSide(color: _ScanUi.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Go Home',
                      style: TextStyle(
                        fontSize: 16,
                        height: 1.35,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 54,
                  child: FilledButton(
                    onPressed: onTryAgain,
                    style: FilledButton.styleFrom(
                      backgroundColor: _ScanUi.primary,
                      foregroundColor: _ScanUi.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Try again',
                      style: TextStyle(
                        fontSize: 16,
                        height: 1.35,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RebateActiveBanner extends StatelessWidget {
  const _RebateActiveBanner({required this.onTapArrow});

  final VoidCallback onTapArrow;

  static const String _body =
      "You can't have meals in the mess if you have an active mess rebate application.";

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _ScanUi.red1,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              _body,
              style: TextStyle(
                fontSize: 16,
                height: 20 / 14,
                fontWeight: FontWeight.w500,
                color: _ScanUi.red,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Material(
            color: _ScanUi.white,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: onTapArrow,
              borderRadius: BorderRadius.circular(12),
              child: const SizedBox(
                width: 53,
                height: 52,
                child: Icon(
                  Icons.chevron_right_rounded,
                  color: _ScanUi.textPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
