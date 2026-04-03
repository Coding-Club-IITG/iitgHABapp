import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/providers/hostels.dart';
import 'package:frontend2/widgets/common/popmenubutton.dart';
import 'package:frontend2/widgets/feedback/FeedBackCard.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utilities/startupitem.dart';
import '../widgets/mess_widgets/horizontal_menu_builder.dart';
import 'package:intl/intl.dart';

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
  bool _isLoading = true;
  bool started_loading = false;
  String caterername = '';
  int? rating;
  int? rank;
  int visibility = 0;

  @override
  void initState() {
    super.initState();
  }

  bool __isloading() {
    if (widget.active && !started_loading) {
      print("Loading Mess Screen Data!");
      started_loading = true;
      _loadData();
    }
    return _isLoading;
  }

  Future<void> _loadData() async {
    await fetchCurrSubscrMess();
    await fetchMessInfo();
    setState(() {
      _isLoading = false; // Only now we render
    });
  }

  Future<void> fetchCurrSubscrMess() async {
    final prefs = await SharedPreferences.getInstance();
    currSubscribedMess = prefs.getString('curr_subscribed_mess') ?? '';
  }

  Future<void> fetchMessInfo() async {
    final prefs = await SharedPreferences.getInstance();
    caterername = prefs.getString('messName') ?? '';
    rating = prefs.getInt('rating') ?? 0;
    rank = prefs.getInt('ranking') ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    if (__isloading()) {
      return const Scaffold(
        backgroundColor: Colors.white, // Force correct bg
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white, // Avoid blue flicker
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: SingleChildScrollView(
                // constraints: BoxConstraints(
                //   minHeight: constraints.maxHeight,
                // ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Mess",
                          style: TextStyle(
                            fontFamily: 'OpenSans_regular',
                            fontSize: 32,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2E2F31),
                          ),
                        ),
                        const SizedBox(height: 18),
                        _MenuSection(),
                        // const SizedBox(height: 24),
                      ],
                    ),
                    // Column(
                    //   children: [
                    //     _MessInfo(
                    //       catererName: caterername,
                    //       rating: rating,
                    //       rank: rank,
                    //     ),
                    //     const SizedBox(height: 30),
                    //   ],
                    // ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _MenuSection extends StatefulWidget {
  @override
  State<_MenuSection> createState() => _MenuSectionState();
}

class _MenuSectionState extends State<_MenuSection> {
  final List<String> daysOnly = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  String? messId;
  late String selectedDay;
  bool _initializedFromProvider = false;
  String?
      _preferredMessName; // from SharedPreferences (curr_subscribed_mess or messName)
  // We'll read hostelMap reactively from provider in build.

  String selectedHostel = HostelsNotifier.userHostel.isNotEmpty
      ? HostelsNotifier.userHostel
      : (HostelsNotifier.hostels.isNotEmpty ? HostelsNotifier.hostels[0] : "");

  late VoidCallback _removeHostelListener;

  @override
  void initState() {
    super.initState();
    // Load preferred mess name from prefs to match against provider map once ready
    SharedPreferences.getInstance().then((prefs) {
      final byCurrSub = prefs.getString('curr_subscribed_mess');
      final byMessName = prefs.getString('messName');
      setState(() {
        _preferredMessName = byCurrSub?.isNotEmpty == true
            ? byCurrSub
            : (byMessName?.isNotEmpty == true ? byMessName : null);
      });
    });
    if (kDebugMode) debugPrint("Selected Hostel rn: $selectedHostel");
    _removeHostelListener = HostelsNotifier.addOnChange(
      () {
        if (!mounted) return;
        // When userHostel changes, update only if we have that hostel in the map.
        final map =
            Provider.of<MessInfoProvider>(context, listen: false).hostelMap;
        final newHostel = HostelsNotifier.userHostel;
        if (newHostel.isNotEmpty && map.containsKey(newHostel)) {
          setState(() {
            selectedHostel = newHostel;
            messId = map[newHostel]?.messid;
          });
        }
      },
    );
    selectedDay = DateFormat('EEEE').format(DateTime.now()); // default to today
    // No hardcoded fallback; wait for provider data in build.
  }

  @override
  void dispose() {
    try {
      _removeHostelListener();
    } catch (e) {
      // ignore
    }
    super.dispose();
  }

  void _updateMessId(String hostelName) {
    final map = Provider.of<MessInfoProvider>(context, listen: false).hostelMap;
    final id = map[hostelName]?.messid; // no hardcoded fallback
    if (id != null) {
      setState(() {
        selectedHostel = hostelName;
        messId = id;
      });
    }
  }

  void _updateDay(String day) {
    setState(() {
      selectedDay = day;
    });
  }

  @override
  Widget build(BuildContext context) {
    final hostelMap = context.watch<MessInfoProvider>().hostelMap;

    // Initialize once when provider data is ready
    if (!_initializedFromProvider && hostelMap.isNotEmpty) {
      // Prefer mapping by subscribed mess name if available
      String? byMessNameKey;
      if (_preferredMessName != null && _preferredMessName!.isNotEmpty) {
        try {
          byMessNameKey = hostelMap.entries
              .firstWhere((e) => e.value.messname == _preferredMessName)
              .key;
        } catch (_) {
          byMessNameKey = null;
        }
      }

      final preferred = HostelsNotifier.userHostel;
      final initialHostel = byMessNameKey ??
          ((preferred.isNotEmpty && hostelMap.containsKey(preferred))
              ? preferred
              : hostelMap.keys.first);

      selectedHostel = initialHostel;
      messId = hostelMap[initialHostel]?.messid;
      _initializedFromProvider = true;
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const FeedbackCard(),
          const SizedBox(height: 24),
          Row(
            children: [
              const Text(
                "What's in Menu",
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF676767)),
              ),
              const Spacer(),
              HostelDrop(
                  selectedHostel: selectedHostel, onChanged: _updateMessId),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: daysOnly.map((day) {
                return _DayChip(
                  label: day,
                  selected: selectedDay == day,
                  onTap: () => _updateDay(day),
                );
              }).toList(),
            ),
          ),
          SingleChildScrollView(
            child: SizedBox(
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  if (messId == null) ...[
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Center(
                          child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  ] else ...[
                    _MealWrapper(
                        meal: 'Breakfast', messId: messId!, day: selectedDay),
                    _MealWrapper(
                        meal: 'Lunch', messId: messId!, day: selectedDay),
                    _MealWrapper(
                        meal: 'Dinner', messId: messId!, day: selectedDay),
                    const SizedBox(height: 24),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.info_outline,
                          size: 16,
                          color: Color(0xFF676767),
                        ),
                        SizedBox(
                          width: 2,
                        ),
                        Text(
                          "Tap on a food item to mark as favourite",
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF676767)),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          )
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
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        focusColor: Colors.transparent,
        splashColor: Colors.transparent,
        hoverColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: selected ? const Color(0xFFEDEDFB) : const Color(0xFFF5F5F5),
          ),
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              fontFamily: 'OpenSans_regular',
              color:
                  selected ? const Color(0xFF4C4EDB) : const Color(0xFF676767),
            ),
          ),
        ),
      ),
    );
  }
}

class _MealWrapper extends StatelessWidget {
  final String meal;
  final String messId;
  final String day;

  const _MealWrapper({
    required this.meal,
    required this.messId,
    required this.day,
  });

  Future<String?> _getUserMessId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('messID') ?? '';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: _getUserMessId(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.all(12),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        final userMessId = snapshot.data ?? '';
        return HorizontalMenuBuilder(
          messId: messId,
          day: day,
          userMessId: userMessId,
          mealType: meal,
        );
      },
    );
  }
}
