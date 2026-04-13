// home_screen.dart

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/mess/mess_menu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:frontend2/models/alert_model.dart';
import 'package:frontend2/models/mess_menu_model.dart';
import 'package:frontend2/models/notification_model.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/providers/notifications.dart';
import 'package:frontend2/providers/room_cleaning_provider.dart';
import 'package:frontend2/screens/laundry/laundry_screen.dart';
import 'package:frontend2/screens/notification.dart';
import 'package:frontend2/screens/account_screen.dart';
import 'package:frontend2/screens/qr_scanner.dart';
import 'package:frontend2/screens/room_cleaning/room_cleaning.dart';
import 'package:frontend2/services/weather_background_service.dart';
import 'package:frontend2/utils/meal_countdown_text.dart';
import 'package:frontend2/utilities/alert_expirer.dart';
import 'package:frontend2/utilities/alert_manager.dart';
import 'package:frontend2/utilities/notifications.dart';
import 'package:frontend2/widgets/common/name_trimmer.dart';
import 'package:frontend2/widgets/common/page_loading_shimmer.dart';
// import 'package:frontend2/widgets/countdown.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';
import 'package:frontend2/widgets/festival_background_widget.dart';
import 'package:frontend2/services/festival_mode_service.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utilities/startupitem.dart';
import 'initial_setup_screen.dart';

class HomeScreen extends StatefulWidget {
  final void Function(int)? onNavigateToTab;
  final VoidCallback? onRefresh;

  const HomeScreen({super.key, this.onNavigateToTab, this.onRefresh});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const bool _isWeatherBackgroundTesting = false;
  static const String _testingWeatherGroup = 'clear'; // clear, rainy
  static const bool _testingIsDay = false;
  static const bool _isTestingNotifications = false;

  static const pageBackground = Color(0xFFFFFFFF);
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
  String name = '';
  String currSubscribedMess = '';
  String? token;
  String? userHostelId;
  final ValueNotifier<_QuickActionStatusData> _scanQrStatusNotifier =
      ValueNotifier(
          const _QuickActionStatusData(status: 'Closed', color: textMuted));
  Timer? _scanQrStatusTimer;
  Timer? _weatherBackgroundTimer;
  Timer? _deferredHomeNetworkTimer;
  /// First weather + optional deferred festival hit server after this delay (not on Home mount).
  static const Duration _kDeferredHomeNetworkDelay = Duration(seconds: 60);
  WeatherBackgroundData _weatherBackground =
      WeatherBackgroundData.localTimeDefault();

  /// When festival mode is off (or rain backdrop): morning & afternoon = purple;
  /// evening & rain = white. Weekend title/username are split in [_getTitleColor] /
  /// [_heroUserNameColor] (white + purple).
  Color _heroAccentColor() {
    final variant = _weatherBackground.backgroundVariant;
    switch (variant) {
      case 'morning':
      case 'afternoon':
        return primary;
      case 'weekend':
      case 'evening':
      case 'rainy':
      default:
        return Colors.white;
    }
  }

  Color _festivalPrimaryColor() {
    final data = FestivalModeService().currentData;
    if (data != null && data.isEnabled) {
      return FestivalThemePalette.resolveColor(data.themeColor);
    }
    return primary;
  }

  @override
  void initState() {
    super.initState();
    fetchUserData();
    fetchMessIdAndToken();
    _startScanQrStatusTicker();
    _deferredHomeNetworkTimer =
        Timer(_kDeferredHomeNetworkDelay, _runDeferredHomeNetworkWork);
    homeScreenRefreshNotifier.addListener(_onRefreshRequested);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncFestivalConfigFromServerIfPending();

      // Add dummy alerts for testing extended background
      if (_isTestingNotifications) {
        final dummyAlerts = [
          AlertModel(
            id: 'dummy-1',
            title: 'Important Messages',
            body: 'Mess will be closed on 29 May, Sunday',
            hasCountdown: false,
            expiresAt: DateTime.now()
                    .add(const Duration(days: 1))
                    .millisecondsSinceEpoch ~/
                1000,
            targetType: 'global',
            isRead: false,
          ),
          AlertModel(
            id: 'dummy-2',
            title: 'Important Messages',
            body: 'Use the scanning feature for filling the complaints',
            hasCountdown: false,
            expiresAt: DateTime.now()
                    .add(const Duration(days: 1))
                    .millisecondsSinceEpoch ~/
                1000,
            targetType: 'global',
            isRead: false,
          ),
        ];
        AlertsManager.activeAlertsNotifier.value = dummyAlerts;
      }

      final roomCleaningProvider = context.read<RoomCleaningProvider>();
      if (!roomCleaningProvider.isBookingsLoading &&
          roomCleaningProvider.myBookings.isEmpty &&
          roomCleaningProvider.bookingsError == null) {
        roomCleaningProvider.loadMyBookings();
      }
    });
  }

  /// Admin changes (theme/text) update `lastUpdatedAt` — [bootstrapBeforeHome] sets a deferred
  /// full `/status` fetch. Run it on first frame instead of waiting for the 60s home timer.
  Future<void> _syncFestivalConfigFromServerIfPending() async {
    if (!mounted) return;
    if (!FestivalModeService().tryConsumeDeferredFestivalFetch()) return;
    try {
      await FestivalModeService()
          .fetchFestivalMode(context: context, forceRefresh: true);
    } catch (_) {
      // [fetchFestivalMode] already falls back to Hive / disabled
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _scanQrStatusTimer?.cancel();
    _weatherBackgroundTimer?.cancel();
    _deferredHomeNetworkTimer?.cancel();
    _scanQrStatusNotifier.dispose();
    homeScreenRefreshNotifier.removeListener(_onRefreshRequested);
    super.dispose();
  }

  Future<void> _onRefreshRequested() async {
    if (homeScreenRefreshNotifier.value) {
      await FestivalModeService()
          .fetchFestivalMode(context: context, forceRefresh: true)
          .catchError((_) => FestivalModeData.disabled());
      if (!mounted) return;
      setState(() {});
      fetchUserData();
      fetchMessIdAndToken();
      await _loadWeatherBackground();
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

  Future<void> _runDeferredHomeNetworkWork() async {
    if (!mounted) return;
    try {
      await _loadWeatherBackground();
      // Festival full sync is triggered from [_syncFestivalConfigFromServerIfPending]
      // on first frame when bootstrap marks it pending — do not wait 60s.
    } finally {
      if (mounted) {
        setState(() {});
        _startWeatherBackgroundTicker();
      }
    }
  }

  Future<void> _loadWeatherBackground() async {
    WeatherBackgroundData nextBackground;

    if (_isWeatherBackgroundTesting) {
      nextBackground = WeatherBackgroundData.testing(
        group: _testingWeatherGroup,
        isDay: _testingIsDay,
      );
    } else {
      nextBackground = await WeatherBackgroundService().fetchBackground();
    }

    if (!mounted) return;
    final hasChanged =
        nextBackground.assetPath != _weatherBackground.assetPath ||
            nextBackground.isDay != _weatherBackground.isDay ||
            nextBackground.weatherGroup != _weatherBackground.weatherGroup ||
            nextBackground.backgroundVariant !=
                _weatherBackground.backgroundVariant;
    if (!hasChanged) return;

    setState(() {
      _weatherBackground = nextBackground;
    });
  }

  String getGreeting() {
    if (_weatherBackground.weatherGroup == 'rainy') {
      return "It's Rainy";
    }

    // Match hero image: same `backgroundVariant` as WeatherBackgroundService.
    switch (_weatherBackground.backgroundVariant) {
      case 'weekend':
        return "It's the Weekend";
      case 'morning':
        return 'Good Morning';
      case 'afternoon':
        return 'Good Afternoon';
      case 'evening':
      default:
        return 'Good Evening';
    }
  }

  String _weatherHeroGreeting(bool hasAlerts) {
    if (_weatherBackground.weatherGroup == 'rainy') {
      return "It's Rainy";
    }
    final festivalData = FestivalModeService().currentData;
    if (festivalData != null && festivalData.isEnabled) {
      if (hasAlerts) {
        if (festivalData.textsWithAlerts.isNotEmpty) {
          return festivalData.textsWithAlerts.first;
        }
        if (festivalData.overlayTextWithAlerts.isNotEmpty) {
          return festivalData.overlayTextWithAlerts;
        }
      } else {
        if (festivalData.textsWithoutAlerts.isNotEmpty) {
          return festivalData.textsWithoutAlerts.first;
        }
        if (festivalData.overlayTextWithoutAlerts.isNotEmpty) {
          return festivalData.overlayTextWithoutAlerts;
        }
      }
    }
    return getGreeting();
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
      _scanQrStatusNotifier.value = const _QuickActionStatusData(
        status: 'Closed',
        color: textMuted,
      );
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
        final isOngoing = (now.isAfter(start) || now.isAtSameMomentAs(start)) &&
            now.isBefore(end);
        if (isOngoing) {
          activeMeal = menu;
          break;
        }
      }

      if (activeMeal == null) {
        _scanQrStatusNotifier.value = const _QuickActionStatusData(
          status: 'Closed',
          color: textMuted,
        );
      } else {
        final mealEnd = _parseMenuTime(activeMeal.endTime);
        _scanQrStatusNotifier.value = _QuickActionStatusData(
          status: mealTimeRemaining(mealEnd.difference(now)),
          color: green,
        );
      }
    } catch (_) {
      _scanQrStatusNotifier.value = const _QuickActionStatusData(
        status: 'Closed',
        color: textMuted,
      );
    }
  }

  void _startScanQrStatusTicker() {
    _scanQrStatusTimer?.cancel();
    _scanQrStatusTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted || currSubscribedMess.isEmpty) return;
      _loadScanQrStatus(currSubscribedMess);
    });
  }

  void _startWeatherBackgroundTicker() {
    _weatherBackgroundTimer?.cancel();
    _weatherBackgroundTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted) return;
      _loadWeatherBackground();
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
    final daysSince = _daysSince(latestCleanedBooking.bookingDate);

    if (daysSince == null || daysSince < 0) {
      return 'Cleaned recently';
    }

    return daysSince == 1 ? 'Cleaned 1 day ago' : 'Cleaned $daysSince days ago';
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
        status: _scanQrStatusNotifier.value.status,
        statusColor: _scanQrStatusNotifier.value.color,
        statusListenable: _scanQrStatusNotifier,
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
          blurRadius: 16,
          offset: Offset.zero,
        ),
      ],
    );
  }

  TextStyle _sectionTitleStyle() {
    return const TextStyle(
      fontSize: 16,
      height: 1.5,
      fontWeight: FontWeight.w500,
      color: textSecondary,
    );
  }

  String _subscribedMessDisplayName(BuildContext context) {
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
        statusText = mealTimeUntilStart(diff);
        statusColor = green;
        currentMenu = menu;
        break;
      }

      final isOngoing = (now.isAfter(start) || now.isAtSameMomentAs(start)) &&
          now.isBefore(end);
      if (isOngoing) {
        final remaining = end.difference(now);
        statusText = mealTimeRemaining(remaining);
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
    return Row(
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
          const Icon(Icons.favorite, color: Color(0xFFF87171), size: 12),
        ],
      ],
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
        if (items.isNotEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < items.length; i++) ...[
                _buildMenuItemText(items[i]),
                if (i != items.length - 1) const SizedBox(height: 4),
              ],
            ],
          ),
      ],
    );
  }

  Widget _buildMessSectionHeader(String messName) {
    const accent = primary;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mess', style: _sectionTitleStyle()),
              const SizedBox(height: 2),
              Text(
                '$messName Mess',
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
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                Text(
                  'View Full Menu',
                  style: TextStyle(
                    fontSize: 14,
                    height: 20 / 14,
                    fontWeight: FontWeight.w500,
                    color: accent,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: accent,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMessSectionForMenus(
    String messName,
    List<MenuModel> menus,
  ) {
    if (currSubscribedMess.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildMessSectionHeader(messName),
        const SizedBox(height: 16),
        _buildHomeMessMenuCard(menus),
      ],
    );
  }

  Widget _buildMessSectionError(String messName) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildMessSectionHeader(messName),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: _cardDecoration(radius: 16),
          child: const Text(
            'Unable to fetch menu',
            style: TextStyle(color: Colors.red),
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
          padding: const EdgeInsets.all(16),
          decoration: _cardDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFFFFFFF), Color(0xFFFFFEF8)],
            ),
            radius: 12,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.only(bottom: 16),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: border)),
                ),
                child: _buildMenuCategory(title: 'DISH', items: dishItems),
              ),
              const SizedBox(height: 16),
              if (breadsRiceItems.isEmpty)
                _buildMenuCategory(
                  title: 'OTHERS',
                  items: otherItems,
                )
              else
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.only(right: 16),
                          decoration: const BoxDecoration(
                            border: Border(right: BorderSide(color: border)),
                          ),
                          child: _buildMenuCategory(
                            title: 'BREADS & RICE',
                            items: breadsRiceItems,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 16),
                          child: _buildMenuCategory(
                            title: 'OTHERS',
                            items: otherItems,
                          ),
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
          MaterialPageRoute(builder: (context) => const AccountScreen()),
        );
      },
      child: ValueListenableBuilder<String>(
        valueListenable: ProfilePictureProvider.profilePictureString,
        builder: (context, value, child) {
          return Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: Color(0xFFC9D4DE),
              shape: BoxShape.circle,
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

  String _getBackgroundAssetPath(String basePath) {
    // Check if there are important messages
    final activeAlerts = AlertsManager.activeAlertsNotifier.value;
    if (activeAlerts.isNotEmpty) {
      // Use extended version when there are important messages
      if (basePath.contains('.png')) {
        return basePath.replaceAll('.png', '_ext.png');
      }
    }
    return basePath;
  }

  Color _getTitleColor() {
    if (_weatherBackground.backgroundVariant == 'weekend') {
      return Colors.white;
    }
    final festivalData = FestivalModeService().currentData;
    final rainPriority = _weatherBackground.weatherGroup == 'rainy';
    if (festivalData != null && festivalData.isEnabled && !rainPriority) {
      return _festivalPrimaryColor();
    }
    return _heroAccentColor();
  }

  Color _getTextColor() {
    final variant = _weatherBackground.backgroundVariant;

    // For morning, afternoon, and weekend use dark/black color
    if (variant == 'morning' ||
        variant == 'afternoon' ||
        variant == 'weekend') {
      return const Color(0xFF2E2F31); // Dark text
    }

    // For evening and raining use white/light color
    return Colors.white;
  }

  /// First name: weekend uses [primary]; else festival or [_heroAccentColor].
  Color _heroUserNameColor() {
    if (_weatherBackground.backgroundVariant == 'weekend') {
      return primary;
    }
    final festivalData = FestivalModeService().currentData;
    final rainPriority = _weatherBackground.weatherGroup == 'rainy';
    if (festivalData != null && festivalData.isEnabled && !rainPriority) {
      return _festivalPrimaryColor();
    }
    return _heroAccentColor();
  }

  Widget _buildWeatherHeroHeader({
    required int unreadCount,
    required bool hasImportantMessages,
  }) {
    final displayName = name.isNotEmpty ? name : 'User';
    final greeting = _weatherHeroGreeting(hasImportantMessages);
    final subtitleText = unreadCount == 1
        ? '1 notification today'
        : '$unreadCount notifications today';

    final titleColor = _getTitleColor();
    final textColor = _getTextColor();

    final greetingFontSize = hasImportantMessages ? 16.0 : 24.0;
    final greetingLineHeight =
        hasImportantMessages ? (20 / 16) : (32 / 24);

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'HABit',
                        style: TextStyle(
                          fontSize: 28,
                          height: 30.4 / 28,
                          fontWeight: FontWeight.w700,
                          color: titleColor,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          'BETA V2',
                          style: TextStyle(
                            fontSize: 12,
                            height: 16 / 12,
                            fontWeight: FontWeight.w500,
                            color: titleColor,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                _buildProfileAvatar(),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: RichText(
                    overflow: TextOverflow.ellipsis,
                    text: TextSpan(
                      style: TextStyle(
                        fontSize: greetingFontSize,
                        height: greetingLineHeight,
                        fontWeight: FontWeight.w500,
                        color: _getTextColor(),
                      ),
                      children: [
                        TextSpan(text: '$greeting, '),
                        TextSpan(
                          text: displayName,
                          style: TextStyle(color: _heroUserNameColor()),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            if (!hasImportantMessages) ...[
              const SizedBox(height: 8),
              Text(
                subtitleText,
                style: TextStyle(
                  fontSize: 12,
                  height: 16 / 12,
                  fontWeight: FontWeight.w500,
                  color: textColor,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildImportantMessagesCard(List<AlertModel> activeAlerts) {
    if (activeAlerts.isEmpty) {
      return const SizedBox.shrink();
    }

    // Take top 2 alerts to prevent the card from getting too massive
    final alerts = activeAlerts.take(2).toList();

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
          for (final alert in alerts)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.only(left: 10),
              decoration: const BoxDecoration(
                border: Border(left: BorderSide(color: yellow, width: 2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (alert.body.isNotEmpty) ...[
                    Text(
                      alert.body,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 20 / 14,
                        fontWeight: FontWeight.w500,
                        color: textPrimary,
                      ),
                    ),
                  ],
                  SilentAlertExpirer(expiresAt: alert.expiresAt),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildUpdatesCard(int unreadCount) {
    const accent = primary;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () {
        // CLEAR THE ALERTS BADGE when they open the sheet
        AlertsManager.markAllAlertsAsRead();
        markAllNotificationsAsRead();
        _openNotificationsSheet();
      },
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
            Icon(Icons.chevron_right_rounded, size: 16, color: accent),
          ],
        ),
      ),
    );
  }

  Widget _buildAlertsSection() {
    return ValueListenableBuilder<List<AlertModel>>(
      valueListenable: AlertsManager.activeAlertsNotifier,
      builder: (context, activeAlerts, child) {
        return ValueListenableBuilder<List<dynamic>>(
          valueListenable: NotificationProvider.notificationProvider,
          builder: (context, storedNotifications, child) {
            final notifications = storedNotifications.map((item) {
              if (item is NotificationModel) return item;
              return NotificationModel.fromLegacyString(item.toString());
            }).toList();

            final unreadNotifCount =
                notifications.where((n) => !n.isRead).length;
            final unreadAlertsCount =
                activeAlerts.where((a) => !a.isRead).length;
            final totalUnreadCount = unreadNotifCount + unreadAlertsCount;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildWeatherHeroHeader(
                  unreadCount: totalUnreadCount,
                  hasImportantMessages: activeAlerts.isNotEmpty,
                ),
                const SizedBox(height: 32),
                if (activeAlerts.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _buildImportantMessagesCard(activeAlerts),
                  ),
                  const SizedBox(height: 32),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _buildUpdatesCard(totalUnreadCount),
                ),
                const SizedBox(height: 32),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildQuickActionCard(_QuickActionData action) {
    const accent = primary;
    final iconChild = action.iconAsset != null
        ? SvgPicture.asset(
            action.iconAsset!,
            width: 24,
            height: 24,
            colorFilter: ColorFilter.mode(accent, BlendMode.srcIn),
          )
        : Icon(action.icon, color: accent, size: 24);

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
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 10),
                child: _buildQuickActionStatusText(
                  action: action,
                  fontSize: 12,
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
              _buildQuickActionStatusText(action: action, fontSize: 13),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionStatusText({
    required _QuickActionData action,
    required double fontSize,
  }) {
    if (action.statusListenable == null) {
      return Text(
        action.status,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w500,
          color: action.statusColor,
        ),
      );
    }

    return ValueListenableBuilder<_QuickActionStatusData>(
      valueListenable: action.statusListenable!,
      builder: (context, statusData, child) {
        return Text(
          statusData.status,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w500,
            color: statusData.color,
          ),
        );
      },
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

  Widget _buildSectionDivider() {
    return const SizedBox(
      width: double.infinity,
      height: 8,
      child: ColoredBox(color: sectionDivider),
    );
  }

  Widget _buildWeatherHeroSection() {
    final festivalModeOn =
        FestivalModeService().currentData?.isEnabled == true;
    final rainPriority = _weatherBackground.weatherGroup == 'rainy';
    final festivalOn = festivalModeOn && !rainPriority;
    final DecorationImage? bgImage = festivalOn
        ? null
        : DecorationImage(
            image: AssetImage(
              _getBackgroundAssetPath(_weatherBackground.assetPath),
            ),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          );

    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      width: double.infinity,
      decoration: BoxDecoration(image: bgImage),
      child: Container(
        decoration: festivalOn
            ? null
            : const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x00FFFFFF),
                    Color(0xFFFFFFFF),
                  ],
                  stops: [0.59, 1.0],
                ),
              ),
        child: _buildAlertsSection(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<AlertModel>>(
      valueListenable: AlertsManager.activeAlertsNotifier,
      builder: (context, activeAlerts, _) {
        final rainPriority = _weatherBackground.weatherGroup == 'rainy';
        return FestivalBackgroundBuilder(
          hasAlerts: activeAlerts.isNotEmpty,
          suppressFestivalBackdrop: rainPriority,
          builder: (context) {
            final festivalModeOn =
                FestivalModeService().currentData?.isEnabled ?? false;
            final festivalOn = festivalModeOn && !rainPriority;
            return Scaffold(
              backgroundColor:
                  festivalOn ? Colors.transparent : pageBackground,
              body: currSubscribedMess.isEmpty
                  ? SingleChildScrollView(
                      child: Column(
                        children: [
                          _buildWeatherHeroSection(),
                          ColoredBox(
                            color: pageBackground,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _buildSectionDivider(),
                                Padding(
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 32, 16, 32),
                                  child:
                                      ValueListenableBuilder<List<String>>(
                                    valueListenable:
                                        HostelsNotifier.hostelNotifier,
                                    builder: (context, _, __) =>
                                        _buildQuickActionsSection(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  : Consumer<MessInfoProvider>(
                      builder: (context, messProvider, __) {
                        if (messProvider.isLoading) {
                          return buildHomeScreenLoadingShimmer();
                        }
                        return FutureBuilder<List<MenuModel>>(
                          future: fetchMenu(currSubscribedMess, getTodayDay()),
                          builder: (context, menuSnap) {
                            if (menuSnap.connectionState ==
                                ConnectionState.waiting) {
                              return buildHomeScreenLoadingShimmer();
                            }
                            final messName =
                                _subscribedMessDisplayName(context);
                            return SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildWeatherHeroSection(),
                                  ColoredBox(
                                    color: pageBackground,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        _buildSectionDivider(),
                                        Padding(
                                          padding: const EdgeInsets.fromLTRB(
                                              16, 32, 16, 32),
                                          child: ValueListenableBuilder<
                                              List<String>>(
                                            valueListenable: HostelsNotifier
                                                .hostelNotifier,
                                            builder: (context, _, __) =>
                                                _buildQuickActionsSection(),
                                          ),
                                        ),
                                        _buildSectionDivider(),
                                        Padding(
                                          padding: const EdgeInsets.fromLTRB(
                                              16, 32, 16, 32),
                                          child: menuSnap.hasError
                                              ? _buildMessSectionError(
                                                  messName)
                                              : _buildMessSectionForMenus(
                                                  messName,
                                                  menuSnap.data ??
                                                      const <MenuModel>[],
                                                ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        );
                      },
                    ),
            );
          },
        );
      },
    );
  }
}

class _QuickActionData {
  final String label;
  final String status;
  final Color statusColor;
  final ValueListenable<_QuickActionStatusData>? statusListenable;
  final IconData? icon;
  final String? iconAsset;
  final VoidCallback onTap;

  const _QuickActionData({
    required this.label,
    required this.status,
    required this.statusColor,
    required this.onTap,
    this.statusListenable,
    this.icon,
    this.iconAsset,
  });
}

class _QuickActionStatusData {
  final String status;
  final Color color;

  const _QuickActionStatusData({
    required this.status,
    required this.color,
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
