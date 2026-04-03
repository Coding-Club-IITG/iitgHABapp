import 'dart:async';
import 'dart:convert';

import 'package:frontend2/apis/mess/mess_menu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:frontend2/models/mess_menu_model.dart';
import 'package:frontend2/models/notification_model.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/providers/notifications.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/screens/laundry/laundry_screen.dart';
import 'package:frontend2/screens/notification.dart';
import 'package:frontend2/screens/profile_screen.dart';
import 'package:frontend2/screens/qr_scanner.dart';
import 'package:frontend2/screens/room_cleaning/room_cleaning.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/widgets/common/name_trimmer.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utilities/startupitem.dart';
import 'mess_preference.dart';

class HomeScreen extends StatefulWidget {
  final void Function(int)? onNavigateToTab;
  final VoidCallback? onRefresh;

  const HomeScreen({super.key, this.onNavigateToTab, this.onRefresh});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  static const pageBackground = Color(0xFFFFFFFF);
  static const topBarBackground = Color(0xFFFAFAFA);
  static const surface = Color(0xFFFFFFFF);
  static const sectionDivider = Color(0xFFF0F0F0);
  static const border = Color(0xFFE6E6E6);
  static const primary = Color(0xFF4C4EDB);
  static const primarySoft = Color(0xFFEDEDFB);
  static const textPrimary = Color(0xFF2E2F31);
  static const textSecondary = Color(0xFF676767);
  static const textMuted = Color(0xFF939393);
  static const green = Color(0xFF1F8441);
  static const yellow = Color(0xFFA36500);
  static const yellowSoft = Color(0xFFFFFAEB);
  static const blueSoft = Color(0xFFE0F1FF);
  static const blue = Color(0xFF3182CE);
  static const shadow = Color(0x14000000);
  static const bool _showDummyImportantMessages = false;

  String name = '';
  String currSubscribedMess = '';
  String? token;
  String? userHostelId;
  String scanQrStatus = 'Closed';
  Color scanQrStatusColor = textMuted;
  Timer? _scanQrStatusTimer;
  late final AnimationController _shimmerController;
  late final Animation<double> _shimmerAnimation;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _shimmerAnimation = Tween<double>(begin: -1.5, end: 2.5).animate(
      CurvedAnimation(parent: _shimmerController, curve: Curves.easeInOut),
    );
    fetchUserData();
    fetchMessIdAndToken();
    _startScanQrStatusTicker();
    homeScreenRefreshNotifier.addListener(_onRefreshRequested);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final roomCleaningProvider = context.read<RoomCleaningProvider>();
      if (!roomCleaningProvider.isBookingsLoading &&
          roomCleaningProvider.myBookings.isEmpty &&
          roomCleaningProvider.bookingsError == null) {
        roomCleaningProvider.loadMyBookings();
      }
    });
  }

  @override
  void dispose() {
    _scanQrStatusTimer?.cancel();
    _shimmerController.dispose();
    homeScreenRefreshNotifier.removeListener(_onRefreshRequested);
    super.dispose();
  }

  void _onRefreshRequested() {
    if (homeScreenRefreshNotifier.value) {
      fetchUserData();
      fetchMessIdAndToken();
      homeScreenRefreshNotifier.value = false;
    }
  }

  Future<void> fetchUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final name1 = prefs.getString('name');
    if (name1 != null && mounted) {
      setState(() {
        name = capitalizeWords(name1).split(' ').first;
      });
    }
  }

  Future<void> fetchMessIdAndToken() async {
    final prefs = await SharedPreferences.getInstance();
    final messId = prefs.getString('messID') ?? '';
    final accessToken = prefs.getString('access_token');
    final hostelId = prefs.getString('hostel') ?? prefs.getString('hostelID');
    if (!mounted) return;
    setState(() {
      currSubscribedMess = messId;
      token = accessToken;
      userHostelId = hostelId;
    });
    await _loadScanQrStatus(messId);
  }

  String getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  String getTodayDay() {
    final now = DateTime.now();
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return days[now.weekday - 1];
  }

  DateTime _parseMenuTime(String timeStr) {
    final now = DateTime.now();
    final parts = timeStr.split(':');
    return DateTime(
      now.year,
      now.month,
      now.day,
      int.parse(parts[0]),
      int.parse(parts[1]),
    );
  }

  String _formatMealCountdown(Duration duration) {
    if (duration.inSeconds <= 0) return '0 min left';
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    if (hours > 0) {
      return '${hours}h ${minutes}m left';
    }
    final safeMinutes = minutes <= 0 ? 1 : minutes;
    return '$safeMinutes min left';
  }

  String _formatTimeWithMeridiem(String time) {
    final parts = time.split(':');
    if (parts.length != 2) return time;

    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return time;

    final suffix = hour >= 12 ? 'PM' : 'AM';
    final twelveHour = hour % 12 == 0 ? 12 : hour % 12;
    final minuteText = minute.toString().padLeft(2, '0');
    return '$twelveHour:$minuteText $suffix';
  }

  Future<void> _loadScanQrStatus(String messId) async {
    if (messId.isEmpty) {
      if (!mounted) return;
      setState(() {
        scanQrStatus = 'Closed';
        scanQrStatusColor = textMuted;
      });
      return;
    }

    try {
      final menus = await fetchMenu(messId, getTodayDay());
      if (!mounted) return;

      final now = DateTime.now();
      MenuModel? activeMeal;
      for (final menu in menus) {
        final start = _parseMenuTime(menu.startTime);
        final end = _parseMenuTime(menu.endTime);
        final isOngoing =
            (now.isAfter(start) || now.isAtSameMomentAs(start)) &&
            now.isBefore(end);
        if (isOngoing) {
          activeMeal = menu;
          break;
        }
      }

      setState(() {
        if (activeMeal == null) {
          scanQrStatus = 'Closed';
          scanQrStatusColor = textMuted;
        } else {
          final mealEnd = _parseMenuTime(activeMeal!.endTime);
          scanQrStatus = _formatMealCountdown(mealEnd.difference(now));
          scanQrStatusColor = green;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        scanQrStatus = 'Closed';
        scanQrStatusColor = textMuted;
      });
    }
  }

  void _startScanQrStatusTicker() {
    _scanQrStatusTimer?.cancel();
    _scanQrStatusTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted || currSubscribedMess.isEmpty) return;
      _loadScanQrStatus(currSubscribedMess);
    });
  }

  Future<void> _requireMicrosoftThenNavigate({
    required String featureName,
    required Widget screen,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
    if (!mounted) return;
    if (!hasMicrosoftLinked) {
      showDialog(
        context: context,
        builder: (context) => MicrosoftRequiredDialog(featureName: featureName),
      );
      return;
    }
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => screen),
    );
  }

  Future<void> _openNotificationsSheet() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const NotificationScreen(),
    );
  }

  int? _daysSince(DateTime? date) {
    if (date == null) return null;
    final now = DateTime.now().toLocal();
    final localDate = date.toLocal();
    final today = DateTime(now.year, now.month, now.day);
    final thatDay = DateTime(localDate.year, localDate.month, localDate.day);
    return today.difference(thatDay).inDays;
  }

  String _buildRoomCleaningStatusText(RoomCleaningProvider provider) {
    final cleanedBookings = provider.myBookings
        .where((booking) => booking.status == 'Cleaned')
        .toList()
      ..sort((a, b) => b.bookingDate.compareTo(a.bookingDate));

    if (cleanedBookings.isEmpty) {
      return 'Not cleaned yet';
    }

    final latestCleanedBooking = cleanedBookings.first;
    final daysSince = _daysSince(latestCleanedBooking?.bookingDate);

    if (daysSince == null || daysSince < 0) {
      return 'Cleaned recently';
    }

    return daysSince == 1
        ? 'Cleaned 1 day ago'
        : 'Cleaned $daysSince days ago';
  }

  List<_QuickActionData> _buildQuickActions() {
    final roomCleaningProvider = context.watch<RoomCleaningProvider>();

    final actions = <_QuickActionData>[
      _QuickActionData(
        label: 'Room Cleaning',
        status: _buildRoomCleaningStatusText(roomCleaningProvider),
        statusColor: green,
        iconAsset: 'assets/icon/room_cleaning_icon.svg',
        onTap: () => _requireMicrosoftThenNavigate(
          featureName: 'Room Cleaning',
          screen: const RoomCleaningScreen(),
        ),
      ),
      _QuickActionData(
        label: 'Scan mess QR',
        status: scanQrStatus,
        statusColor: scanQrStatusColor,
        iconAsset: 'assets/icon/qrscan.svg',
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const QrScan()),
          );
        },
      ),
      // _QuickActionData(
      //   label: 'Mess Change',
      //   status: 'Open',
      //   statusColor: primary,
      //   iconAsset: 'assets/icon/messicon.svg',
      //   onTap: () => _requireMicrosoftThenNavigate(
      //     featureName: 'Mess Change',
      //     screen: const MessChangePreferenceScreen(),
      //   ),
      // ),
    ];

    if (HostelsNotifier.isLaundryAvailableForHostel(userHostelId)) {
      actions.add(
        _QuickActionData(
          label: 'Laundry Service',
          status: 'Available',
          statusColor: green,
          icon: Icons.local_laundry_service_outlined,
          onTap: () => _requireMicrosoftThenNavigate(
            featureName: 'Laundry Service',
            screen: const LaundryScreen(),
          ),
        ),
      );
    }

    return actions;
  }

  BoxDecoration _cardDecoration({
    Gradient? gradient,
    Border? customBorder,
    double radius = 16,
  }) {
    return BoxDecoration(
      color: surface,
      gradient: gradient,
      borderRadius: BorderRadius.circular(radius),
      border: customBorder ?? Border.all(color: border),
      boxShadow: const [
        BoxShadow(
          color: shadow,
          blurRadius: 6,
          offset: Offset(0, 4),
        ),
      ],
    );
  }

  TextStyle _sectionTitleStyle() {
    return const TextStyle(
      fontSize:16,
      height: 1.5,
      fontWeight: FontWeight.w500,
      color: textSecondary,
    );
  }

  Future<String> _resolveMessName(BuildContext context) async {
    final provider = context.read<MessInfoProvider>();
    if (provider.hostelMap.isEmpty) return 'Your Mess';

    for (final entry in provider.hostelMap.entries) {
      if (entry.value.messid == currSubscribedMess) {
        return entry.key;
      }
    }
    return 'Your Mess';
  }

  _HomeMessCardData _getHomeMessCardData(List<MenuModel> menus) {
    final now = DateTime.now();
    MenuModel? currentMenu;
    var statusText = 'is over';
    var statusColor = textMuted;

    for (final menu in menus) {
      final start = _parseMenuTime(menu.startTime);
      final end = _parseMenuTime(menu.endTime);

      if (now.isBefore(start)) {
        final diff = start.difference(now);
        final hours = diff.inHours;
        final minutes = diff.inMinutes.remainder(60);
        statusText = 'In ${hours > 0 ? '${hours}h ' : ''}${minutes}m';
        statusColor = green;
        currentMenu = menu;
        break;
      }

      final isOngoing =
          (now.isAfter(start) || now.isAtSameMomentAs(start)) &&
          now.isBefore(end);
      if (isOngoing) {
        final remaining = end.difference(now);
        statusText = _formatMealCountdown(remaining).replaceAll(' left', '');
        statusColor = green;
        currentMenu = menu;
        break;
      }
    }

    currentMenu ??= menus.isNotEmpty ? menus.last : null;
    return _HomeMessCardData(
      currentMenu: currentMenu,
      statusText: statusText,
      statusColor: statusColor,
    );
  }

  List<MenuItemModel> _itemsForType(MenuModel menu, String type) {
    return menu.items.where((item) => item.type == type).toList();
  }

  Widget _buildMenuItemText(MenuItemModel item) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              item.name,
              style: const TextStyle(
                fontSize: 14,
                height: 20 / 14,
                fontWeight: FontWeight.w500,
                color: textPrimary,
              ),
            ),
          ),
          if (item.isLiked) ...[
            const SizedBox(width: 8),
            const Icon(Icons.favorite, color: Color(0xFFF87171), size: 14),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuCategory({
    required String title,
    required List<MenuItemModel> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            height: 16 / 12,
            fontWeight: FontWeight.w500,
            color: textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        if (items.isEmpty)
          const Text(
            '-',
            style: TextStyle(
              fontSize: 14,
              height: 20 / 14,
              fontWeight: FontWeight.w500,
              color: textPrimary,
            ),
          ),
        for (final item in items) _buildMenuItemText(item),
      ],
    );
  }

  Widget _buildShimmerBlock({
    required double height,
    double? width,
    BorderRadius radius = const BorderRadius.all(Radius.circular(8)),
  }) {
    return AnimatedBuilder(
      animation: _shimmerAnimation,
      builder: (context, child) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: radius,
            gradient: LinearGradient(
              begin: Alignment(_shimmerAnimation.value - 1, 0),
              end: Alignment(_shimmerAnimation.value + 1, 0),
              colors: const [
                Color(0xFFF2F2F2),
                Color(0xFFF9F9F9),
                Color(0xFFF2F2F2),
              ],
              stops: const [0.1, 0.5, 0.9],
            ),
          ),
        );
      },
    );
  }

  Widget _buildMenuShimmerPlaceholder() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _buildShimmerBlock(height: 28, width: 110),
            const SizedBox(width: 8),
            _buildShimmerBlock(height: 24, width: 84),
            const Spacer(),
            _buildShimmerBlock(height: 20, width: 110),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: _cardDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFFFFFFF), Color(0xFFFFFEF8)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildShimmerBlock(height: 16, width: 48, radius: BorderRadius.circular(4)),
              const SizedBox(height: 12),
              _buildShimmerBlock(height: 18),
              const SizedBox(height: 8),
              _buildShimmerBlock(height: 18, width: 180),
              const SizedBox(height: 12),
              const Divider(height: 1, thickness: 1, color: Color(0xFFE6E6E6)),
              const SizedBox(height: 20),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildShimmerBlock(
                            height: 16,
                            width: 96,
                            radius: BorderRadius.circular(4),
                          ),
                          const SizedBox(height: 12),
                          _buildShimmerBlock(height: 18),
                          const SizedBox(height: 8),
                          _buildShimmerBlock(height: 18, width: 120),
                        ],
                      ),
                    ),
                    Container(
                      width: 1,
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      color: const Color(0xFFE6E6E6),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildShimmerBlock(
                            height: 16,
                            width: 60,
                            radius: BorderRadius.circular(4),
                          ),
                          const SizedBox(height: 12),
                          _buildShimmerBlock(height: 18),
                          const SizedBox(height: 8),
                          _buildShimmerBlock(height: 18, width: 90),
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
    );
  }

  Widget _buildHomeMessMenuCard(List<MenuModel> menus) {
    if (menus.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(),
        child: const Text(
          'No menu available today.',
          style: TextStyle(fontSize: 14, color: textSecondary),
        ),
      );
    }

    final cardData = _getHomeMessCardData(menus);
    final menu = cardData.currentMenu!;
    final dishItems = _itemsForType(menu, 'Dish');
    final breadsRiceItems = _itemsForType(menu, 'Breads and Rice');
    final otherItems = _itemsForType(menu, 'Others');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              menu.type,
              style: const TextStyle(
                fontSize: 20,
                height: 28 / 20,
                fontWeight: FontWeight.w500,
                color: textPrimary,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              cardData.statusText,
              style: TextStyle(
                fontSize: 18,
                height: 24 / 18,
                fontWeight: FontWeight.w500,
                color: cardData.statusColor,
              ),
            ),
            const Spacer(),
            Text(
              '${_formatTimeWithMeridiem(menu.startTime)} - ${_formatTimeWithMeridiem(menu.endTime)}',
              style: const TextStyle(
                fontSize: 14,
                height: 20 / 14,
                fontWeight: FontWeight.w500,
                color: textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: _cardDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFFFFFFF), Color(0xFFFFFEF8)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildMenuCategory(title: 'DISH', items: dishItems),
              const SizedBox(height: 12),
              const Divider(height: 1, thickness: 1, color: Color(0xFFE6E6E6)),
              const SizedBox(height: 20),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _buildMenuCategory(
                        title: 'BREADS & RICE',
                        items: breadsRiceItems,
                      ),
                    ),
                    Container(
                      width: 1,
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      color: const Color(0xFFE6E6E6),
                    ),
                    Expanded(
                      child: _buildMenuCategory(
                        title: 'OTHERS',
                        items: otherItems,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildProfileAvatar() {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const ProfileScreen()),
        );
      },
      child: ValueListenableBuilder<String>(
        valueListenable: ProfilePictureProvider.profilePictureString,
        builder: (context, value, child) {
          return Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFC9D4DE),
              borderRadius: BorderRadius.circular(24),
            ),
            clipBehavior: Clip.antiAlias,
            child: value.isNotEmpty
                ? Image.memory(base64Decode(value), fit: BoxFit.cover)
                : Image.asset(
              'assets/images/default_profile.png',
              fit: BoxFit.cover,
            ),
          );
        },
      ),
    );
  }

  Widget _buildTopBar() {
    final displayName = name.isNotEmpty ? name : 'User';
    return Container(
      decoration: const BoxDecoration(
        color: topBarBackground,
        border: Border(bottom: BorderSide(color: border)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'HABit',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            '${getGreeting()}, $displayName',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w500,
                              color: textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              _buildProfileAvatar(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImportantMessagesCard(List<NotificationModel> activeAlerts) {
    if (activeAlerts.isEmpty) {
      return const SizedBox.shrink();
    }

    final messages = activeAlerts
        .take(2)
        .map((alert) => alert.body.isNotEmpty ? alert.body : alert.title)
        .toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFFFF), Color(0xFFFFE9DC)],
          stops: [0.42, 1.0],
        ),
        customBorder: Border.all(color: const Color(0xFFE5D9B4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: yellowSoft,
                child: Icon(
                  Icons.warning_amber_rounded,
                  size: 25,
                  color: yellow,
                ),
              ),
              SizedBox(width: 8),
              Text(
                'Important Messages',
                style: TextStyle(
                  fontSize: 14,
                  height: 20 / 14,
                  fontWeight: FontWeight.w500,
                  color: yellow,
                ),
              ),
            ],
          ),
          // const SizedBox(height: 8),
          for (final message in messages)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.only(left: 10),
              decoration: const BoxDecoration(
                border: Border(left: BorderSide(color: yellow, width: 2)),
              ),
              child: Text(
                message,
                style: const TextStyle(
                  fontSize: 14,
                  height: 20 / 14,
                  fontWeight: FontWeight.w500,
                  color: textPrimary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildUpdatesCard(int unreadCount) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: _openNotificationsSheet,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(),
        child: Row(
          children: [
            const CircleAvatar(
              radius: 12,
              backgroundColor: blueSoft,
              child: Icon(
                Icons.notifications_none_rounded,
                size: 16,
                color: blue,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '$unreadCount Updates',
              style: const TextStyle(
                fontSize: 14,
                height: 20 / 14,
                fontWeight: FontWeight.w500,
                color: textPrimary,
              ),
            ),
            const Spacer(),
            const Icon(Icons.chevron_right_rounded, size: 16, color: primary),
          ],
        ),
      ),
    );
  }

  Widget _buildAlertsSection() {
    return ValueListenableBuilder<List<dynamic>>(
      valueListenable: NotificationProvider.notificationProvider,
      builder: (context, storedNotifications, child) {
        final notifications = storedNotifications.map((item) {
          if (item is NotificationModel) return item;
          return NotificationModel.fromLegacyString(item.toString());
        }).toList();

        final activeAlerts = notifications
            .where(
              (notification) =>
          notification.isAlertActive && !notification.isRead,
        )
            .toList();
        final unreadCount =
            notifications.where((notification) => !notification.isRead).length;
        final displayedAlerts = activeAlerts.isNotEmpty
            ? activeAlerts
            : (_showDummyImportantMessages
                  ?  [
                      NotificationModel(
                        title: 'Water supply interruption',
                        body:
                            'Water supply will be unavailable in Hostel Block C from 2:00 PM to 4:00 PM today.',
                        timestamp: DateTime.now(),
                        isRead: false,
                        // isAlertActive: true,
                      ),
                      NotificationModel(
                        title: 'Mess timing update',
                        body:
                            'Dinner will begin 30 minutes late today due to kitchen maintenance.',
                        timestamp: DateTime.now(),
                        isRead: false,
                        // isAlertActive: true,
                      ),
                    ]
                  : const <NotificationModel>[]);

        return Column(
          children: [
            if (displayedAlerts.isNotEmpty) ...[
              _buildImportantMessagesCard(displayedAlerts),
              const SizedBox(height: 16),
            ],
            _buildUpdatesCard(unreadCount),
          ],
        );
      },
    );
  }

  Widget _buildQuickActionCard(_QuickActionData action) {
    final iconChild = action.iconAsset != null
        ? SvgPicture.asset(
      action.iconAsset!,
      width: 24,
      height: 24,
      colorFilter: const ColorFilter.mode(primary, BlendMode.srcIn),
    )
        : Icon(action.icon, color: primary, size: 24);

    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: action.onTap,
        child: Container(
          height: 148,
          padding: const EdgeInsets.all(16),
          decoration: _cardDecoration(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: primarySoft,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: iconChild,
              ),
              // const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 10),
                child: Text(
                  action.status,
                  style: TextStyle(
                    fontSize: 12,
                    // height: 16 / 12,
                    fontWeight: FontWeight.w500,
                    color: action.statusColor,
                  ),
                ),
              ),
              // const SizedBox(height: 4),
              Text(
                action.label,
                style: const TextStyle(
                  fontSize: 14,
                  // height: 20 / 14,
                  fontWeight: FontWeight.w500,
                  color: textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSecondaryActionChip(_QuickActionData action) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: action.onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border),
            boxShadow: const [
              BoxShadow(
                color: shadow,
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                action.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                action.status,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: action.statusColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionsSection() {
    final actions = _buildQuickActions();
    final featured = actions.take(2).toList();
    final secondary = actions.skip(2).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quick Actions', style: _sectionTitleStyle()),
        const SizedBox(height: 24),
        Row(
          children: [
            _buildQuickActionCard(featured[0]),
            const SizedBox(width: 12),
            _buildQuickActionCard(featured[1]),
          ],
        ),
        if (secondary.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              for (var i = 0; i < secondary.length; i++) ...[
                _buildSecondaryActionChip(secondary[i]),
                if (i != secondary.length - 1) const SizedBox(width: 12),
              ],
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildMessSection() {
    if (currSubscribedMess.isEmpty) return const SizedBox.shrink();

    return FutureBuilder<String>(
      future: _resolveMessName(context),
      builder: (context, snapshot) {
        final messName = snapshot.data ?? 'Your Mess';
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Mess', style: _sectionTitleStyle()),
                      const SizedBox(height: 2),
                      Text(
                        "$messName Mess",
                        style: const TextStyle(
                          fontSize: 14,
                          height: 20 / 14,
                          color: textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                InkWell(
                  onTap: () => widget.onNavigateToTab?.call(1),
                  borderRadius: BorderRadius.circular(16),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: [
                        Text(
                          'View & Edit',
                          style: TextStyle(
                            fontSize: 14,
                            height: 20 / 14,
                            fontWeight: FontWeight.w500,
                            color: primary,
                          ),
                        ),
                        SizedBox(width: 4),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 20,
                          color: primary,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Consumer<MessInfoProvider>(
              builder: (context, messProvider, child) {
                if (messProvider.isLoading) {
                  return _buildMenuShimmerPlaceholder();
                }

                return FutureBuilder<List<MenuModel>>(
                  future: fetchMenu(currSubscribedMess, getTodayDay()),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return _buildMenuShimmerPlaceholder();
                    }

                    if (snapshot.hasError) {
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: _cardDecoration(radius: 16),
                        child: const Text(
                          'Unable to fetch menu',
                          style: TextStyle(color: Colors.red),
                        ),
                      );
                    }

                    return _buildHomeMessMenuCard(snapshot.data ?? const []);
                  },
                );
              },
            ),
          ],
        );
      },
    );
  }

  Widget _buildSectionDivider() {
    return const SizedBox(
      width: double.infinity,
      height: 8,
      child: ColoredBox(color: sectionDivider),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: pageBackground,
      body: Column(
        children: [
          _buildTopBar(),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    child: _buildAlertsSection(),
                  ),
                  _buildSectionDivider(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
                    child: ValueListenableBuilder<List<String>>(
                      valueListenable: HostelsNotifier.hostelNotifier,
                      builder: (context, _, __) => _buildQuickActionsSection(),
                    ),
                  ),
                  if (currSubscribedMess.isNotEmpty) ...[
                    _buildSectionDivider(),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
                      child: _buildMessSection(),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionData {
  final String label;
  final String status;
  final Color statusColor;
  final IconData? icon;
  final String? iconAsset;
  final VoidCallback onTap;

  const _QuickActionData({
    required this.label,
    required this.status,
    required this.statusColor,
    required this.onTap,
    this.icon,
    this.iconAsset,
  });
}

class _HomeMessCardData {
  final MenuModel? currentMenu;
  final String statusText;
  final Color statusColor;

  const _HomeMessCardData({
    required this.currentMenu,
    required this.statusText,
    required this.statusColor,
  });
}
