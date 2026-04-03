import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../apis/mess/menu_like.dart';
import '../apis/mess/mess_menu.dart';
import '../models/mess_menu_model.dart';
import '../providers/hostels.dart';
import '../utilities/startupitem.dart';

class MessApp extends StatefulWidget {
  final bool active;

  const MessApp({super.key, this.active = false});

  @override
  State<MessApp> createState() => _MessAppState();
}

class _MessAppState extends State<MessApp> {
  @override
  Widget build(BuildContext context) {
    return MessScreen(active: widget.active);
  }
}

class MessScreen extends StatefulWidget {
  final bool active;

  const MessScreen({super.key, this.active = false});

  @override
  State<MessScreen> createState() => _MessScreenState();
}

String currSubscribedMess = '';

class _MessScreenState extends State<MessScreen> {
  static const pageBackground = Color(0xFFFFFFFF);
  static const topBarBackground = Color(0xFFFAFAFA);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE6E6E6);
  static const primary = Color(0xFF4C4EDB);
  static const primarySoft = Color(0xFFEDEDFB);
  static const textPrimary = Color(0xFF2E2F31);
  static const textSecondary = Color(0xFF676767);
  static const textMuted = Color(0xFF535353);
  static const green = Color(0xFF1F8441);
  static const red = Color(0xFFC40205);
  static const redSoft = Color(0xFFFCF0F0);
  static const greySoft = Color(0xFFF5F5F5);
  static const shadow = Color(0x14000000);

  bool _isLoading = true;
  bool _startedLoading = false;

  @override
  Widget build(BuildContext context) {
    if (_shouldLoad()) {
      return const Scaffold(
        backgroundColor: pageBackground,
        body: _MessScreenInitialLoading(),
      );
    }

    return Scaffold(
      backgroundColor: pageBackground,
      body: Column(
        children: [
          Container(
            decoration: const BoxDecoration(
              color: topBarBackground,
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: const SafeArea(
              bottom: false,
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Row(
                  children: [
                    Text(
                      'Mess',
                      style: TextStyle(
                        fontSize: 32,
                        height: 48 / 32,
                        fontWeight: FontWeight.w500,
                        color: textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 20, 16, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _MenuSection(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _shouldLoad() {
    if (widget.active && !_startedLoading) {
      _startedLoading = true;
      _loadData();
    }
    return _isLoading;
  }

  Future<void> _loadData() async {
    await _fetchCurrSubscrMess();
    if (!mounted) return;
    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _fetchCurrSubscrMess() async {
    final prefs = await SharedPreferences.getInstance();
    currSubscribedMess = prefs.getString('curr_subscribed_mess') ?? '';
  }
}

class _MenuSection extends StatefulWidget {
  const _MenuSection();

  @override
  State<_MenuSection> createState() => _MenuSectionState();
}

class _MenuSectionState extends State<_MenuSection> {
  static const daysOnly = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  String? messId;
  String? userMessId;
  late String selectedDay;
  String? selectedHostel;
  String? _preferredMessName;
  bool _initializedFromProvider = false;
  bool _menuRequested = false;
  List<MenuModel> _menus = const [];
  bool _isMenuLoading = true;
  String? _menuError;
  Timer? _statusTicker;
  late VoidCallback _removeHostelListener;

  @override
  void initState() {
    super.initState();
    selectedDay = DateFormat('EEEE').format(DateTime.now());
    selectedHostel = HostelsNotifier.userHostel.isNotEmpty
        ? HostelsNotifier.userHostel
        : (HostelsNotifier.hostels.isNotEmpty ? HostelsNotifier.hostels.first : null);
    _loadPreferences();
    _statusTicker = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
    _removeHostelListener = HostelsNotifier.addOnChange(() {
      if (!mounted) return;
      final map = context.read<MessInfoProvider>().hostelMap;
      final newHostel = HostelsNotifier.userHostel;
      if (newHostel.isNotEmpty && map.containsKey(newHostel)) {
        setState(() {
          selectedHostel = newHostel;
          messId = map[newHostel]?.messid;
        });
        _loadMenus();
      }
    });
  }

  @override
  void dispose() {
    _statusTicker?.cancel();
    try {
      _removeHostelListener();
    } catch (_) {}
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      final byCurrSub = prefs.getString('curr_subscribed_mess');
      final byMessName = prefs.getString('messName');
      _preferredMessName = byCurrSub?.isNotEmpty == true
          ? byCurrSub
          : (byMessName?.isNotEmpty == true ? byMessName : null);
      userMessId = prefs.getString('messID') ?? '';
    });
  }

  Future<void> _loadMenus() async {
    final currentMessId = messId;
    if (currentMessId == null || currentMessId.isEmpty) return;

    setState(() {
      _isMenuLoading = true;
      _menuError = null;
    });

    try {
      final menus = await fetchMenu(currentMessId, selectedDay);
      if (!mounted || messId != currentMessId) return;
      setState(() {
        _menus = menus;
        _isMenuLoading = false;
      });
    } catch (_) {
      if (!mounted || messId != currentMessId) return;
      setState(() {
        _menus = const [];
        _menuError = 'Unable to fetch menu';
        _isMenuLoading = false;
      });
    }
  }

  void _initializeFromProvider(Map<String, dynamic> hostelMap) {
    if (_initializedFromProvider || hostelMap.isEmpty) return;

    String? byMessNameKey;
    if (_preferredMessName != null && _preferredMessName!.isNotEmpty) {
      try {
        byMessNameKey = hostelMap.entries
            .firstWhere((entry) => entry.value.messname == _preferredMessName)
            .key
            .toString();
      } catch (_) {
        byMessNameKey = null;
      }
    }

    final preferred = HostelsNotifier.userHostel;
    final initialHostel = byMessNameKey ??
        ((preferred.isNotEmpty && hostelMap.containsKey(preferred))
            ? preferred
            : hostelMap.keys.first.toString());

    selectedHostel = initialHostel;
    messId = hostelMap[initialHostel]?.messid;
    _initializedFromProvider = true;
  }

  void _requestInitialMenuLoad() {
    if (_menuRequested || messId == null || messId!.isEmpty) return;
    _menuRequested = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadMenus();
      }
    });
  }

  void _updateMess(String hostelName) {
    final map = context.read<MessInfoProvider>().hostelMap;
    final id = map[hostelName]?.messid;
    if (id == null) return;
    setState(() {
      selectedHostel = hostelName;
      messId = id;
      _menuRequested = true;
    });
    _loadMenus();
  }

  void _updateDay(String day) {
    setState(() {
      selectedDay = day;
      _menuRequested = true;
    });
    _loadMenus();
  }

  @override
  Widget build(BuildContext context) {
    final hostelMap = context.watch<MessInfoProvider>().hostelMap;
    _initializeFromProvider(hostelMap);
    _requestInitialMenuLoad();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Menu',
              style: TextStyle(
                fontSize: 16,
                height: 24 / 16,
                fontWeight: FontWeight.w500,
                color: _MessScreenState.textSecondary,
              ),
            ),
            const Spacer(),
            _HostelSelector(
              selectedHostel: selectedHostel,
              hostelNames: hostelMap.keys.map((e) => e.toString()).toList(),
              onSelected: _updateMess,
            ),
          ],
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: daysOnly.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final day = daysOnly[index];
              return _DayChip(
                label: day,
                selected: selectedDay == day,
                onTap: () => _updateDay(day),
              );
            },
          ),
        ),
        const SizedBox(height: 20),
        if (_isMenuLoading)
          const _MenuLoadingState()
        else if (_menuError != null)
          const _MenuErrorCard()
        else if (_menus.isEmpty)
          const _MenuEmptyCard()
        else
          _MealList(
            key: ValueKey('$messId-$selectedDay'),
            menus: _menus,
            selectedDay: selectedDay,
            userMessId: userMessId ?? '',
            selectedMessId: messId ?? '',
          ),
      ],
    );
  }
}

class _HostelSelector extends StatelessWidget {
  final String? selectedHostel;
  final List<String> hostelNames;
  final ValueChanged<String> onSelected;

  const _HostelSelector({
    required this.selectedHostel,
    required this.hostelNames,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final hostel = selectedHostel;
    if (hostel == null || hostel.isEmpty || hostelNames.isEmpty) {
      return const SizedBox.shrink();
    }

    return PopupMenuButton<String>(
      onSelected: onSelected,
      color: Colors.white,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: _MessScreenState.border),
      ),
      itemBuilder: (context) => hostelNames
          .map(
            (name) => PopupMenuItem<String>(
              value: name,
              child: Text(
                name,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: _MessScreenState.textPrimary,
                ),
              ),
            ),
          )
          .toList(),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            hostel,
            style: const TextStyle(
              fontSize: 14,
              height: 20 / 14,
              fontWeight: FontWeight.w500,
              color: _MessScreenState.primary,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(
            Icons.unfold_more_rounded,
            size: 20,
            color: _MessScreenState.primary,
          ),
        ],
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _DayChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? _MessScreenState.primarySoft : _MessScreenState.surface,
          borderRadius: BorderRadius.circular(8),
          border: selected
              ? null
              : Border.all(color: _MessScreenState.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            height: 20 / 14,
            fontWeight: FontWeight.w500,
            color: selected
                ? _MessScreenState.primary
                : _MessScreenState.textMuted,
          ),
        ),
      ),
    );
  }
}

class _MealList extends StatefulWidget {
  final List<MenuModel> menus;
  final String selectedDay;
  final String userMessId;
  final String selectedMessId;

  const _MealList({
    super.key,
    required this.menus,
    required this.selectedDay,
    required this.userMessId,
    required this.selectedMessId,
  });

  @override
  State<_MealList> createState() => _MealListState();
}

class _MealListState extends State<_MealList> {
  String? _expandedMealType;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _syncExpandedMeal();
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted) return;
      setState(() {
        _syncExpandedMeal();
      });
    });
  }

  @override
  void didUpdateWidget(covariant _MealList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedDay != widget.selectedDay ||
        oldWidget.selectedMessId != widget.selectedMessId ||
        oldWidget.menus != widget.menus) {
      _syncExpandedMeal();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _syncExpandedMeal() {
    final suggested = _suggestExpandedMealType(widget.menus, widget.selectedDay);
    _expandedMealType ??= suggested;
    if (!widget.menus.any((menu) => menu.type == _expandedMealType)) {
      _expandedMealType = suggested;
    }
  }

  DateTime _parseTime(String timeStr) {
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

  String _suggestExpandedMealType(List<MenuModel> menus, String day) {
    if (menus.isEmpty) return 'Breakfast';
    if (!_isToday(day)) return menus.first.type;

    final now = DateTime.now();
    for (final menu in menus) {
      final start = _parseTime(menu.startTime);
      final end = _parseTime(menu.endTime);
      final isOngoing =
          (now.isAfter(start) || now.isAtSameMomentAs(start)) && now.isBefore(end);
      if (now.isBefore(start) || isOngoing) {
        return menu.type;
      }
    }
    return menus.last.type;
  }

  bool _isToday(String day) {
    const dayMap = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 7,
    };
    return dayMap[day.toLowerCase()] == DateTime.now().weekday;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final menu in widget.menus) ...[
          _MealCard(
            menu: menu,
            isSubscribed: widget.userMessId == widget.selectedMessId,
            statusDisplay: _isToday(widget.selectedDay),
            expanded: _expandedMealType == menu.type,
            onToggle: () {
              setState(() {
                _expandedMealType =
                    _expandedMealType == menu.type ? null : menu.type;
              });
            },
          ),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 8),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.info_outline,
              size: 16,
              color: _MessScreenState.textSecondary,
            ),
            SizedBox(width: 4),
            Text(
              'Tap on a food item to mark as favourite',
              style: TextStyle(
                fontSize: 14,
                height: 20 / 14,
                fontWeight: FontWeight.w500,
                color: _MessScreenState.textSecondary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _MealCard extends StatefulWidget {
  final MenuModel menu;
  final bool isSubscribed;
  final bool statusDisplay;
  final bool expanded;
  final VoidCallback onToggle;

  const _MealCard({
    required this.menu,
    required this.isSubscribed,
    required this.statusDisplay,
    required this.expanded,
    required this.onToggle,
  });

  @override
  State<_MealCard> createState() => _MealCardState();
}

class _MealCardState extends State<_MealCard> {
  late MenuModel _menu;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _menu = widget.menu;
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void didUpdateWidget(covariant _MealCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.menu != widget.menu) {
      _menu = widget.menu;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  DateTime _parseTime(String timeStr) {
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

  String _statusText() {
    if (!widget.statusDisplay || _menu.startTime.isEmpty || _menu.endTime.isEmpty) {
      return '';
    }

    final now = DateTime.now();
    final start = _parseTime(_menu.startTime);
    final end = _parseTime(_menu.endTime);

    if (now.isBefore(start)) {
      final diff = start.difference(now);
      final hours = diff.inHours;
      final minutes = diff.inMinutes.remainder(60);
      return 'In ${hours > 0 ? '${hours}h ' : ''}${minutes}m';
    }

    final isOngoing =
        (now.isAfter(start) || now.isAtSameMomentAs(start)) && now.isBefore(end);
    if (isOngoing) {
      final remaining = end.difference(now);
      final hours = remaining.inHours;
      final minutes = remaining.inMinutes.remainder(60);
      return hours > 0 ? '${hours}h ${minutes}m left' : '${minutes <= 0 ? 1 : minutes}m left';
    }

    return 'is over';
  }

  Color _statusColor(String status) {
    return status.startsWith('In') || status.contains('left')
        ? _MessScreenState.green
        : _MessScreenState.textSecondary;
  }

  int _totalLikes() {
    return _menu.items.where((item) => item.isLiked).length;
  }

  Future<void> _toggleLike(String itemId, int index) async {
    if (!widget.isSubscribed) return;

    setState(() {
      _menu.items[index].isLiked = !_menu.items[index].isLiked;
    });

    try {
      final success = await MenuLikeAPI.toggleLike(itemId);
      if (!success && mounted) {
        setState(() {
          _menu.items[index].isLiked = !_menu.items[index].isLiked;
        });
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint(error.toString());
      }
      if (!mounted) return;
      setState(() {
        _menu.items[index].isLiked = !_menu.items[index].isLiked;
      });
    }
  }

  String _formatMealTime(String time) {
    final parts = time.split(':');
    if (parts.length != 2) return time;
    final hour = int.tryParse(parts[0]) ?? 0;
    final minute = int.tryParse(parts[1]) ?? 0;
    final suffix = hour >= 12 ? 'PM' : 'AM';
    final twelveHour = hour % 12 == 0 ? 12 : hour % 12;
    final minuteText = minute.toString().padLeft(2, '0');
    return '$twelveHour:$minuteText $suffix';
  }

  List<MenuItemModel> _itemsForType(String type) {
    return _menu.items.where((item) => item.type == type).toList();
  }

  Widget _buildMenuChip(MenuItemModel item, int index) {
    final chipColor = item.isLiked && widget.isSubscribed
        ? _MessScreenState.redSoft
        : _MessScreenState.greySoft;
    final iconColor = item.isLiked && widget.isSubscribed
        ? _MessScreenState.red
        : _MessScreenState.textSecondary;

    return GestureDetector(
      onTap: widget.isSubscribed ? () => _toggleLike(item.id, index) : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: chipColor,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              item.isLiked ? Icons.favorite : Icons.favorite_border,
              size: 12,
              color: iconColor,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                item.name,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: 'Manrope_semibold',
                  fontSize: 14,
                  height: 1,
                  fontWeight: FontWeight.w600,
                  color: _MessScreenState.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<MenuItemModel> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'Manrope_semibold',
            fontSize: 12,
            height: 1,
            fontWeight: FontWeight.w600,
            color: _MessScreenState.textMuted,
          ),
        ),
        const SizedBox(height: 16),
        if (items.isEmpty)
          const Text(
            '-',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: _MessScreenState.textPrimary,
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final item in items) _buildMenuChip(item, _menu.items.indexOf(item)),
            ],
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = _statusText();
    final likes = _totalLikes();
    final dishItems = _itemsForType('Dish');
    final breadsRiceItems = _itemsForType('Breads and Rice');
    final otherItems = _itemsForType('Others');

    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: _MessScreenState.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _MessScreenState.border),
          boxShadow: const [
            BoxShadow(
              color: _MessScreenState.shadow,
              blurRadius: 6,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: widget.onToggle,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Flexible(
                            child: Text(
                              _menu.type,
                              style: TextStyle(
                                fontSize: 16,
                                height: 24 / 16,
                                fontWeight: FontWeight.w500,
                                color: widget.expanded
                                    ? _MessScreenState.textPrimary
                                    : _MessScreenState.textSecondary,
                              ),
                            ),
                          ),
                          if (widget.expanded && status.isNotEmpty) ...[
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                status,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 16,
                                  height: 24 / 16,
                                  fontWeight: FontWeight.w500,
                                  color: _statusColor(status),
                                ),
                              ),
                            ),
                          ] else if (!widget.expanded && widget.isSubscribed) ...[
                            const SizedBox(width: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: likes > 0
                                    ? _MessScreenState.redSoft
                                    : _MessScreenState.greySoft,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    likes > 0
                                        ? Icons.favorite
                                        : Icons.favorite_border,
                                    size: 14,
                                    color: likes > 0
                                        ? _MessScreenState.red
                                        : _MessScreenState.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '$likes',
                                    style: TextStyle(
                                      fontSize: 14,
                                      height: 20 / 14,
                                      fontWeight: FontWeight.w500,
                                      color: likes > 0
                                          ? _MessScreenState.red
                                          : _MessScreenState.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Icon(
                      widget.expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 20,
                      color: _MessScreenState.primary,
                    ),
                  ],
                ),
                if (widget.expanded) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(
                        Icons.access_time,
                        size: 16,
                        color: _MessScreenState.textSecondary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${_formatMealTime(_menu.startTime)} - ${_formatMealTime(_menu.endTime)}',
                        style: const TextStyle(
                          fontSize: 14,
                          height: 20 / 14,
                          fontWeight: FontWeight.w500,
                          color: _MessScreenState.textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildSection(title: 'DISH', items: dishItems),
                  const SizedBox(height: 16),
                  const Divider(
                    height: 1,
                    thickness: 1,
                    color: _MessScreenState.border,
                  ),
                  const SizedBox(height: 16),
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _buildSection(
                            title: 'BREADS & RICE',
                            items: breadsRiceItems,
                          ),
                        ),
                        Container(
                          width: 1,
                          margin: const EdgeInsets.symmetric(horizontal: 16),
                          color: _MessScreenState.border,
                        ),
                        Expanded(
                          child: _buildSection(
                            title: 'OTHERS',
                            items: otherItems,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MenuLoadingState extends StatelessWidget {
  const _MenuLoadingState();

  @override
  Widget build(BuildContext context) {
    return const _MessMenuLoadingSkeleton();
  }
}

class _MessScreenInitialLoading extends StatelessWidget {
  const _MessScreenInitialLoading();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Container(
            decoration: const BoxDecoration(
              color: _MessScreenState.topBarBackground,
              border: Border(
                bottom: BorderSide(color: _MessScreenState.border),
              ),
            ),
            child: const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  _MessShimmerBlock(height: 48, width: 84),
                ],
              ),
            ),
          ),
          const Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 20, 16, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _MessMenuLoadingSkeleton(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessMenuLoadingSkeleton extends StatelessWidget {
  const _MessMenuLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _MessShimmerBlock(height: 24, width: 52),
            Spacer(),
            _MessShimmerBlock(height: 20, width: 92),
          ],
        ),
        SizedBox(height: 20),
        _MessDayChipsSkeleton(),
        SizedBox(height: 20),
        _MessMealCardSkeleton(expanded: false),
        SizedBox(height: 12),
        _MessMealCardSkeleton(expanded: false),
        SizedBox(height: 12),
        _MessMealCardSkeleton(expanded: false),
        SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _MessShimmerBlock(
              height: 16,
              width: 16,
              radius: BorderRadius.all(Radius.circular(8)),
            ),
            SizedBox(width: 6),
            _MessShimmerBlock(height: 18, width: 220),
          ],
        ),
      ],
    );
  }
}

class _MessDayChipsSkeleton extends StatelessWidget {
  const _MessDayChipsSkeleton();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: const [
          _MessShimmerBlock(height: 36, width: 70),
          SizedBox(width: 8),
          _MessShimmerBlock(height: 36, width: 72),
          SizedBox(width: 8),
          _MessShimmerBlock(height: 36, width: 96),
          SizedBox(width: 8),
          _MessShimmerBlock(height: 36, width: 84),
        ],
      ),
    );
  }
}

class _MessMealCardSkeleton extends StatelessWidget {
  final bool expanded;

  const _MessMealCardSkeleton({required this.expanded});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _MessScreenState.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _MessScreenState.border),
        boxShadow: const [
          BoxShadow(
            color: _MessScreenState.shadow,
            blurRadius: 6,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    _MessShimmerBlock(height: 24, width: 84),
                    SizedBox(width: 8),
                    _MessShimmerBlock(height: 24, width: 56),
                  ],
                ),
              ),
              _MessShimmerBlock(height: 20, width: 20),
            ],
          ),
          if (expanded) ...[
            const SizedBox(height: 12),
            const _MessShimmerBlock(height: 20, width: 140),
            const SizedBox(height: 16),
            const _MessShimmerBlock(height: 16, width: 40),
            const SizedBox(height: 16),
            const Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _MessShimmerBlock(height: 28, width: 84),
                _MessShimmerBlock(height: 28, width: 134),
                _MessShimmerBlock(height: 28, width: 92),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(
              height: 1,
              thickness: 1,
              color: _MessScreenState.border,
            ),
            const SizedBox(height: 16),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _MessShimmerBlock(height: 16, width: 88),
                        SizedBox(height: 16),
                        _MessShimmerBlock(height: 28, width: 78),
                        SizedBox(height: 8),
                        _MessShimmerBlock(height: 28, width: 94),
                      ],
                    ),
                  ),
                  Container(
                    width: 1,
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    color: _MessScreenState.border,
                  ),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _MessShimmerBlock(height: 16, width: 52),
                        SizedBox(height: 16),
                        _MessShimmerBlock(height: 28, width: 88),
                        SizedBox(height: 8),
                        _MessShimmerBlock(height: 28, width: 96),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MessShimmerBlock extends StatefulWidget {
  final double height;
  final double? width;
  final BorderRadius radius;

  const _MessShimmerBlock({
    required this.height,
    this.width,
    this.radius = const BorderRadius.all(Radius.circular(8)),
  });

  @override
  State<_MessShimmerBlock> createState() => _MessShimmerBlockState();
}

class _MessShimmerBlockState extends State<_MessShimmerBlock>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _animation = Tween<double>(begin: -1.5, end: 2.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.radius,
            gradient: LinearGradient(
              begin: Alignment(_animation.value - 1, 0),
              end: Alignment(_animation.value + 1, 0),
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
}

class _MenuErrorCard extends StatelessWidget {
  const _MenuErrorCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _MessScreenState.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _MessScreenState.border),
        boxShadow: const [
          BoxShadow(
            color: _MessScreenState.shadow,
            blurRadius: 6,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: const Text(
        'Unable to fetch menu',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.red,
        ),
      ),
    );
  }
}

class _MenuEmptyCard extends StatelessWidget {
  const _MenuEmptyCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _MessScreenState.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _MessScreenState.border),
        boxShadow: const [
          BoxShadow(
            color: _MessScreenState.shadow,
            blurRadius: 6,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: const Text(
        'No menu available today.',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: _MessScreenState.textSecondary,
        ),
      ),
    );
  }
}
