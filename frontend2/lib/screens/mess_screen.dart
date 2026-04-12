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
import '../models/mess_info_model.dart';
import '../utilities/startupitem.dart';
import '../widgets/common/hostel_logo.dart';
import '../widgets/common/shimmer_host.dart';
import 'leave_application_list_screen.dart';
import 'mess_preference.dart';

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
  /// Figma: section separator between menu and lower blocks
  static const sectionDividerGrey = Color(0xFFF0F0F0);
  /// Vertical gap between content and full-bleed section dividers (matches Figma rhythm).
  static const double sectionGap = 20;

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
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Mess',
                    style: TextStyle(
                      fontSize: 32,
                      height: 48 / 32,
                      fontWeight: FontWeight.w500,
                      color: textPrimary,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: 20),
                  _MenuSection(),
                ],
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
  /// True while loading after user picked another hostel — full-page shimmers.
  bool _hostelTransitionLoading = false;
  String? _menuError;
  Timer? _statusTicker;
  final ScrollController _dayScrollController = ScrollController();
  late final List<GlobalKey> _dayChipKeys;
  late VoidCallback _removeHostelListener;

  @override
  void initState() {
    super.initState();
    _dayChipKeys = List.generate(daysOnly.length, (_) => GlobalKey());
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToSelectedDay(animated: false);
    });
  }

  @override
  void dispose() {
    _statusTicker?.cancel();
    _dayScrollController.dispose();
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
    if (currentMessId == null || currentMessId.isEmpty) {
      if (mounted) {
        setState(() {
          _isMenuLoading = false;
          _hostelTransitionLoading = false;
        });
      }
      return;
    }

    setState(() {
      _isMenuLoading = true;
      _menuError = null;
    });

    try {
      final menus = await fetchMenu(currentMessId, selectedDay);
      if (!mounted || messId != currentMessId) {
        if (mounted) {
          setState(() {
            _isMenuLoading = false;
            _hostelTransitionLoading = false;
          });
        }
        return;
      }
      setState(() {
        _menus = menus;
        _isMenuLoading = false;
        _hostelTransitionLoading = false;
      });
    } catch (_) {
      if (!mounted || messId != currentMessId) {
        if (mounted) {
          setState(() {
            _isMenuLoading = false;
            _hostelTransitionLoading = false;
          });
        }
        return;
      }
      setState(() {
        _menus = const [];
        _menuError = 'Unable to fetch menu';
        _isMenuLoading = false;
        _hostelTransitionLoading = false;
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
      _hostelTransitionLoading = true;
    });
    _loadMenus();
  }

  void _updateDay(String day) {
    setState(() {
      selectedDay = day;
      _menuRequested = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToSelectedDay();
    });
    _loadMenus();
  }

  void _scrollToSelectedDay({bool animated = true}) {
    if (!_dayScrollController.hasClients) return;

    final selectedIndex = daysOnly.indexOf(selectedDay);
    if (selectedIndex < 0 || selectedIndex >= _dayChipKeys.length) return;

    final selectedContext = _dayChipKeys[selectedIndex].currentContext;
    if (selectedContext == null) return;

    Scrollable.ensureVisible(
      selectedContext,
      alignment: 0.5,
      duration: animated ? const Duration(milliseconds: 250) : Duration.zero,
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final hostelMap = context.watch<MessInfoProvider>().hostelMap;
    _initializeFromProvider(hostelMap);
    _requestInitialMenuLoad();

    final fullPageShimmer = _hostelTransitionLoading;

    if (fullPageShimmer) {
      return ShimmerHost(
        builder: (context, box) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                16,
                0,
                16,
                _MessScreenState.sectionGap,
              ),
              child: Column(
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
                        hostelNames:
                            hostelMap.keys.map((e) => e.toString()).toList(),
                        onSelected: _updateMess,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _MessMenuBodyLoadingSkeleton(box: box),
                ],
              ),
            ),
            _MessLowerPageSkeleton(box: box),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            16,
            0,
            16,
            _MessScreenState.sectionGap,
          ),
          child: Column(
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
                    hostelNames:
                        hostelMap.keys.map((e) => e.toString()).toList(),
                    onSelected: _updateMess,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                height: 36,
                child: ListView.separated(
                  controller: _dayScrollController,
                  scrollDirection: Axis.horizontal,
                  itemCount: daysOnly.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final day = daysOnly[index];
                    return KeyedSubtree(
                      key: _dayChipKeys[index],
                      child: _DayChip(
                        label: day,
                        selected: selectedDay == day,
                        onTap: () => _updateDay(day),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
              if (_isMenuLoading)
                ShimmerHost(
                  builder: (context, box) =>
                      _MessMenuBodyLoadingSkeleton(box: box),
                )
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
          ),
        ),
        ...[
          const _MessScreenSectionDivider(),
          const Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              _MessScreenState.sectionGap,
              16,
              _MessScreenState.sectionGap,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _MessChangeRow(),
                SizedBox(height: _MessScreenState.sectionGap),
                _MessRebateRow(),
              ],
            ),
          ),
          const _MessScreenSectionDivider(),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              16,
              _MessScreenState.sectionGap,
              16,
              32,
            ),
            child: _MessInfoSection(
              selectedHostel: selectedHostel,
              hostelMap: hostelMap,
            ),
          ),
        ],
      ],
    );
  }
}

/// Same card style as [_MessRebateRow]; opens mess change (preference) flow.
class _MessChangeRow extends StatelessWidget {
  const _MessChangeRow();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const MessChangePreferenceScreen(),
            ),
          );
        },
        child: Ink(
          decoration: BoxDecoration(
            color: _MessScreenState.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _MessScreenState.border),
            boxShadow: const [
              BoxShadow(
                color: _MessScreenState.shadow,
                blurRadius: 16,
                offset: Offset(0, 0),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _MessScreenState.primarySoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.swap_horiz_rounded,
                    size: 24,
                    color: _MessScreenState.primary,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Mess Change',
                    style: TextStyle(
                      fontSize: 16,
                      height: 24 / 16,
                      fontWeight: FontWeight.w500,
                      color: _MessScreenState.textPrimary,
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: _MessScreenState.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
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
                // Match home mess card item text (Figma CC-HAB-App menu list).
                style: const TextStyle(
                  fontSize: 14,
                  height: 20 / 14,
                  fontWeight: FontWeight.w500,
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
          // Match home `_buildMenuCategory` section label (Figma).
          style: const TextStyle(
            fontSize: 12,
            height: 16 / 12,
            fontWeight: FontWeight.w500,
            color: _MessScreenState.textSecondary,
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
                              // Match home mess card meal name (Figma).
                              style: TextStyle(
                                fontSize: 20,
                                height: 28 / 20,
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
                                  fontSize: 18,
                                  height: 24 / 18,
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
                          color: _MessScreenState.textSecondary,
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
                  if (breadsRiceItems.isEmpty)
                    _buildSection(
                      title: 'OTHERS',
                      items: otherItems,
                    )
                  else
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

/// Day chips + meal cards + hint (no duplicate "Menu" row — use under real header).
class _MessMenuBodyLoadingSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;

  const _MessMenuBodyLoadingSkeleton({required this.box});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MessDayChipsSkeleton(box: box),
        const SizedBox(height: 20),
        _MessMealCardSkeleton(box: box, expanded: false),
        const SizedBox(height: 12),
        _MessMealCardSkeleton(box: box, expanded: false),
        const SizedBox(height: 12),
        _MessMealCardSkeleton(box: box, expanded: false),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            box(
              height: 16,
              width: 16,
              borderRadius: const BorderRadius.all(Radius.circular(8)),
            ),
            const SizedBox(width: 6),
            box(height: 18, width: 220),
          ],
        ),
      ],
    );
  }
}

class _MessScreenInitialLoading extends StatelessWidget {
  const _MessScreenInitialLoading();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ShimmerHost(
        builder: (context, box) => Column(
          children: [
            Container(
              decoration: const BoxDecoration(
                color: _MessScreenState.topBarBackground,
                border: Border(
                  bottom: BorderSide(color: _MessScreenState.border),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Row(
                  children: [
                    box(height: 48, width: 84),
                  ],
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                  child: _MessMenuLoadingSkeleton(box: box),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessMenuLoadingSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;

  const _MessMenuLoadingSkeleton({required this.box});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            box(height: 24, width: 52),
            const Spacer(),
            box(height: 20, width: 92),
          ],
        ),
        const SizedBox(height: 20),
        _MessMenuBodyLoadingSkeleton(box: box),
      ],
    );
  }
}

/// Dividers + Mess Change / Rebate / Mess Info placeholders (hostel switch loading).
class _MessLowerPageSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;

  const _MessLowerPageSkeleton({required this.box});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _MessScreenSectionDivider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            16,
            _MessScreenState.sectionGap,
            16,
            _MessScreenState.sectionGap,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _MessActionRowSkeleton(box: box),
              const SizedBox(height: _MessScreenState.sectionGap),
              _MessActionRowSkeleton(box: box),
            ],
          ),
        ),
        const _MessScreenSectionDivider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            16,
            _MessScreenState.sectionGap,
            16,
            32,
          ),
          child: _MessInfoCardSkeleton(box: box),
        ),
      ],
    );
  }
}

class _MessActionRowSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;

  const _MessActionRowSkeleton({required this.box});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _MessScreenState.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _MessScreenState.border),
        boxShadow: const [
          BoxShadow(
            color: _MessScreenState.shadow,
            blurRadius: 16,
            offset: Offset(0, 0),
          ),
        ],
      ),
      child: Row(
        children: [
          box(
            height: 40,
            width: 40,
            borderRadius: const BorderRadius.all(Radius.circular(18)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: box(height: 20, width: 120),
            ),
          ),
          const SizedBox(width: 8),
          box(height: 20, width: 20),
        ],
      ),
    );
  }
}

class _MessInfoCardSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;

  const _MessInfoCardSkeleton({required this.box});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        box(height: 16, width: 72),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _MessScreenState.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _MessScreenState.border),
            boxShadow: const [
              BoxShadow(
                color: _MessScreenState.shadow,
                blurRadius: 16,
                offset: Offset(0, 0),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              box(height: 14, width: 88),
              const SizedBox(height: 8),
              box(height: 28, width: 200),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(
                  height: 1,
                  thickness: 1,
                  color: _MessScreenState.border,
                ),
              ),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          box(height: 14, width: 52),
                          const SizedBox(height: 8),
                          box(height: 36, width: 64),
                        ],
                      ),
                    ),
                    Container(
                      width: 1,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      color: _MessScreenState.border,
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          box(height: 14, width: 40),
                          const SizedBox(height: 8),
                          box(height: 36, width: 48),
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
}

class _MessDayChipsSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;

  const _MessDayChipsSkeleton({required this.box});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          box(height: 36, width: 70),
          const SizedBox(width: 8),
          box(height: 36, width: 72),
          const SizedBox(width: 8),
          box(height: 36, width: 96),
          const SizedBox(width: 8),
          box(height: 36, width: 84),
        ],
      ),
    );
  }
}

class _MessMealCardSkeleton extends StatelessWidget {
  final ShimmerBoxBuilder box;
  final bool expanded;

  const _MessMealCardSkeleton({required this.box, required this.expanded});

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
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    box(height: 24, width: 84),
                    const SizedBox(width: 8),
                    box(height: 24, width: 56),
                  ],
                ),
              ),
              box(height: 20, width: 20),
            ],
          ),
          if (expanded) ...[
            const SizedBox(height: 12),
            box(height: 20, width: 140),
            const SizedBox(height: 16),
            box(height: 16, width: 40),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                box(height: 28, width: 84),
                box(height: 28, width: 134),
                box(height: 28, width: 92),
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
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        box(height: 16, width: 88),
                        const SizedBox(height: 16),
                        box(height: 28, width: 78),
                        const SizedBox(height: 8),
                        box(height: 28, width: 94),
                      ],
                    ),
                  ),
                  Container(
                    width: 1,
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    color: _MessScreenState.border,
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        box(height: 16, width: 52),
                        const SizedBox(height: 16),
                        box(height: 28, width: 88),
                        const SizedBox(height: 8),
                        box(height: 28, width: 96),
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

/// Figma: full-bleed 8px grey band between major sections.
class _MessScreenSectionDivider extends StatelessWidget {
  const _MessScreenSectionDivider();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: _MessScreenState.sectionDividerGrey,
      child: SizedBox(height: 8, width: double.infinity),
    );
  }
}

class _MessRebateRow extends StatelessWidget {
  const _MessRebateRow();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const LeaveApplicationListScreen(),
            ),
          );
        },
        child: Ink(
          decoration: BoxDecoration(
            color: _MessScreenState.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _MessScreenState.border),
            boxShadow: const [
              BoxShadow(
                color: _MessScreenState.shadow,
                blurRadius: 16,
                offset: Offset(0, 0),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _MessScreenState.primarySoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.currency_rupee_rounded,
                    size: 24,
                    color: _MessScreenState.primary,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Mess Rebate',
                    style: TextStyle(
                      fontSize: 16,
                      height: 24 / 16,
                      fontWeight: FontWeight.w500,
                      color: _MessScreenState.textPrimary,
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: _MessScreenState.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MessInfoSection extends StatelessWidget {
  final String? selectedHostel;
  final Map<String, HostelData> hostelMap;

  const _MessInfoSection({
    required this.selectedHostel,
    required this.hostelMap,
  });

  @override
  Widget build(BuildContext context) {
    final hostel = selectedHostel;
    final data =
        hostel != null && hostelMap.containsKey(hostel) ? hostelMap[hostel] : null;

    final catererName = data?.messname ?? '—';
    final rating = data?.rating;
    final rank = data?.ranking;
    final feedbackPct = data?.feedbackPercentage;

    final isUnranked = rank == null || rank == 0;

    final ratingText = rating == null
        ? '—'
        : (rating == 0
            ? '—'
            : truncateToTwoDecimals(rating).toStringAsFixed(2));
    final feedbackText = feedbackPct == null
        ? '—'
        : '${truncateToTwoDecimals(feedbackPct).toStringAsFixed(2)}%';
    final leftMetricText = isUnranked ? feedbackText : ratingText;
    final rankText = isUnranked ? 'Unranked' : rank.toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Mess Info',
          style: TextStyle(
            fontSize: 16,
            height: 24 / 16,
            fontWeight: FontWeight.w500,
            color: _MessScreenState.textSecondary,
          ),
        ),
        const SizedBox(height: 20),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _MessScreenState.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _MessScreenState.border),
            boxShadow: const [
              BoxShadow(
                color: _MessScreenState.shadow,
                blurRadius: 16,
                offset: Offset(0, 0),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Caterer Name',
                    style: TextStyle(
                      fontSize: 14,
                      height: 20 / 14,
                      fontWeight: FontWeight.w500,
                      color: _MessScreenState.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          catererName,
                          style: const TextStyle(
                            fontSize: 24,
                            height: 32 / 24,
                            fontWeight: FontWeight.w500,
                            color: _MessScreenState.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      HostelLogo(
                        hostelName: hostel,
                        height: 56,
                        backgroundColor: _MessScreenState.primarySoft,
                      ),
                    ],
                  ),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(
                  height: 1,
                  thickness: 1,
                  color: _MessScreenState.border,
                ),
              ),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isUnranked ? 'Feedback %' : 'Rating',
                            style: const TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w500,
                              color: _MessScreenState.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            leftMetricText,
                            style: const TextStyle(
                              fontSize: 32,
                              height: 48 / 32,
                              fontWeight: FontWeight.w500,
                              color: _MessScreenState.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 1,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      color: _MessScreenState.border,
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Rank',
                            style: TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w500,
                              color: _MessScreenState.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            rankText,
                            style: const TextStyle(
                              fontSize: 32,
                              height: 48 / 32,
                              fontWeight: FontWeight.w500,
                              color: _MessScreenState.textPrimary,
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
        if (isUnranked) ...[
          const SizedBox(height: 12),
          const Text(
            '*Mess with less than 40% feedback percentage are not ranked.',
            style: TextStyle(
              fontSize: 12,
              height: 16 / 12,
              fontWeight: FontWeight.w400,
              color: _MessScreenState.textMuted,
            ),
          ),
        ],
      ],
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
