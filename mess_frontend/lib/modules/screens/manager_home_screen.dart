import 'dart:async';
import 'package:flutter/material.dart';
import '../../apis/manager_api.dart';
import '../models/manager_models.dart';
import '../widgets/shared_widgets.dart';
import 'scan_logs_screens.dart';
import 'user_profile_screen.dart';
import 'leave_applications_screen.dart';

class ManagerHomeScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const ManagerHomeScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  int _currentIndex = 0;
  bool _galaInitialized = false;
  bool _leavesInitialized = false;

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      TodayMessScreen(
        hostelName: widget.hostelName,
        authToken: widget.authToken,
        isActive: _currentIndex == 0, // Tells the tab if it is currently visible
      ),
      if (_galaInitialized)
        GalaSummaryScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
          isActive: _currentIndex == 1,
        )
      else
        const SizedBox.shrink(),
      if (_leavesInitialized)
        LeaveApplicationsScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
        )
      else
        const SizedBox.shrink(),
    ];

    final items = <BottomNavigationBarItem>[
      const BottomNavigationBarItem(
        icon: Icon(Icons.restaurant),
        label: 'Today Mess',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.celebration),
        label: 'Gala Dinner',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.fact_check_outlined),
        label: 'Leaves',
      ),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        items: items,
        onTap: (index) {
          setState(() {
            if (index == 1) _galaInitialized = true;
            if (index == 2) _leavesInitialized = true;
            _currentIndex = index;
          });
        },
        selectedItemColor: const Color(0xFF111827),
        unselectedItemColor: const Color(0xFF9CA3AF),
        backgroundColor: Colors.white,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}

class TodayMessScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;
  final bool isActive;

  const TodayMessScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
    required this.isActive,
  });

  @override
  State<TodayMessScreen> createState() => _TodayMessScreenState();
}

class _TodayMessScreenState extends State<TodayMessScreen> {
  bool _loading = true;
  String? _error;
  List<RecentEntry> _breakfastEntries = const [];
  List<RecentEntry> _lunchEntries = const [];
  List<RecentEntry> _dinnerEntries = const [];
  Timer? _timer;
  Map<String, int> _totals = const {
    'breakfast': 0,
    'lunch': 0,
    'dinner': 0,
  };

  @override
  void initState() {
    super.initState();
    _fetch();
    if (widget.isActive) {
      _startTimer();
    }
  }

  // Detects when the user switches tabs to pause/resume the timer
  @override
  void didUpdateWidget(covariant TodayMessScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _fetch(); // Fetch immediately on return
      _startTimer();
    } else if (!widget.isActive && oldWidget.isActive) {
      _timer?.cancel();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    if (!widget.isActive) return;
    
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted) return;
      // ONLY fetch if this screen is the top-most screen (pauses when profile/logs are pushed)
      if (ModalRoute.of(context)?.isCurrent == true) {
        _fetch();
      }
    });
  }

  Future<void> _openMealLogs(BuildContext context, String meal) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MessMealScanLogsScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
          meal: meal,
        ),
      ),
    );
    // Refresh immediately when returning from the logs screen
    if (mounted && widget.isActive) _fetch();
  }

  Future<void> _fetch() async {
    try {
      final data = await ManagerApi.fetchTodayMessSummary(widget.authToken);
      final recentMap =
          (data['recent'] as Map<String, dynamic>? ?? <String, dynamic>{});
      final totalsMap =
          (data['totals'] as Map<String, dynamic>? ?? <String, dynamic>{});

      List<RecentEntry> breakfast = mapRecent(recentMap['breakfast']);
      List<RecentEntry> lunch = mapRecent(recentMap['lunch']);
      List<RecentEntry> dinner = mapRecent(recentMap['dinner']);

      int compareByTime(RecentEntry a, RecentEntry b) {
        final ta = parseScanTimeForSort(a.time);
        final tb = parseScanTimeForSort(b.time);
        return tb.compareTo(ta);
      }

      breakfast.sort(compareByTime);
      lunch.sort(compareByTime);
      dinner.sort(compareByTime);

      if (!mounted) return;
      setState(() {
        _breakfastEntries = breakfast;
        _lunchEntries = lunch;
        _dinnerEntries = dinner;
        _totals = {
          'breakfast': (totalsMap['breakfast'] as int?) ?? 0,
          'lunch': (totalsMap['lunch'] as int?) ?? 0,
          'dinner': (totalsMap['dinner'] as int?) ?? 0,
        };
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ErrorState(
        message: 'Failed to load today\'s scans.\n$_error',
      );
    }

    final allMerged = <RecentEntry>[
      ..._breakfastEntries,
      ..._lunchEntries,
      ..._dinnerEntries,
    ];
    allMerged.sort((a, b) {
      final ta = parseScanTimeForSort(a.time);
      final tb = parseScanTimeForSort(b.time);
      return tb.compareTo(ta);
    });
    final visibleEntries =
        allMerged.length > 20 ? allMerged.take(20).toList() : allMerged;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Today\'s Mess',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.hostelName,
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Total Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openMealLogs(context, 'Breakfast'),
                      child: TotalPill(
                        label: 'Breakfast',
                        count: _totals['breakfast'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openMealLogs(context, 'Lunch'),
                      child: TotalPill(
                        label: 'Lunch',
                        count: _totals['lunch'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openMealLogs(context, 'Dinner'),
                      child: TotalPill(
                        label: 'Dinner',
                        count: _totals['dinner'] ?? 0,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Recent Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
        const Divider(
          color: Color(0xFFE5E7EB),
          height: 1,
        ),
        Expanded(
          child: visibleEntries.isEmpty
              ? const Center(
                  child: Text(
                    'No scans yet for today.\nNew scans will appear here instantly.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 13,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  itemCount: visibleEntries.length,
                  itemBuilder: (context, index) {
                    final entry = visibleEntries[index];
                    return GestureDetector(
                      onTap: entry.userId.isEmpty
                          ? null
                          : () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ManagerUserProfileScreen(
                                    userId: entry.userId,
                                    authToken: widget.authToken,
                                  ),
                                ),
                              );
                              // Refresh immediately when returning from profile
                              if (mounted && widget.isActive) _fetch();
                            },
                      child: RecentScanCard(entry: entry),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class GalaSummaryScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;
  final bool isActive;

  const GalaSummaryScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
    required this.isActive,
  });

  @override
  State<GalaSummaryScreen> createState() => _GalaSummaryScreenState();
}

class _GalaSummaryScreenState extends State<GalaSummaryScreen> {
  bool _loading = true;
  String? _error;
  List<RecentEntry> _startersEntries = const [];
  List<RecentEntry> _mainCourseEntries = const [];
  List<RecentEntry> _dessertsEntries = const [];
  Timer? _timer;
  Map<String, int> _totals = const {
    'starters': 0,
    'mainCourse': 0,
    'desserts': 0,
  };
  bool _hasGalaToday = false;

  @override
  void initState() {
    super.initState();
    _fetch();
    if (widget.isActive) {
      _startTimer();
    }
  }

  // Detects when the user switches tabs to pause/resume the timer
  @override
  void didUpdateWidget(covariant GalaSummaryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _fetch();
      _startTimer();
    } else if (!widget.isActive && oldWidget.isActive) {
      _timer?.cancel();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    if (!widget.isActive) return;

    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted) return;
      // ONLY fetch if this screen is the top-most screen
      if (ModalRoute.of(context)?.isCurrent == true) {
        _fetch();
      }
    });
  }

  Future<void> _openCourseLogs(BuildContext context, String course) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GalaCourseScanLogsScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
          course: course,
        ),
      ),
    );
    if (mounted && widget.isActive) _fetch();
  }

  Future<void> _fetch() async {
    try {
      final data = await ManagerApi.fetchGalaSummary(widget.authToken);
      final gala = data['galaDinner'];
      if (gala == null) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = null;
          _hasGalaToday = false;
          _startersEntries = const [];
          _mainCourseEntries = const [];
          _dessertsEntries = const [];
          _totals = const {
            'starters': 0,
            'mainCourse': 0,
            'desserts': 0,
          };
        });
        return;
      }

      final recentMap =
          (data['recent'] as Map<String, dynamic>? ?? <String, dynamic>{});
      final totalsMap =
          (data['totals'] as Map<String, dynamic>? ?? <String, dynamic>{});

      List<RecentEntry> starters = mapRecent(recentMap['starters']);
      List<RecentEntry> main = mapRecent(recentMap['mainCourse']);
      List<RecentEntry> desserts = mapRecent(recentMap['desserts']);

      int compareByTime(RecentEntry a, RecentEntry b) {
        final ta = parseScanTimeForSort(a.time);
        final tb = parseScanTimeForSort(b.time);
        return tb.compareTo(ta);
      }

      starters.sort(compareByTime);
      main.sort(compareByTime);
      desserts.sort(compareByTime);

      if (!mounted) return;
      setState(() {
        _startersEntries = starters;
        _mainCourseEntries = main;
        _dessertsEntries = desserts;
        _totals = {
          'starters': (totalsMap['starters'] as int?) ?? 0,
          'mainCourse': (totalsMap['mainCourse'] as int?) ?? 0,
          'desserts': (totalsMap['desserts'] as int?) ?? 0,
        };
        _hasGalaToday = true;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ErrorState(
        message: 'Failed to load Gala Dinner scans.\n$_error',
      );
    }
    if (!_hasGalaToday) {
      return const Center(
        child: Text(
          'No Gala Dinner Scheduled for Today',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0xFF6B7280),
            fontSize: 14,
          ),
        ),
      );
    }

    final allMerged = <RecentEntry>[
      ..._startersEntries,
      ..._mainCourseEntries,
      ..._dessertsEntries,
    ];
    allMerged.sort((a, b) {
      final ta = parseScanTimeForSort(a.time);
      final tb = parseScanTimeForSort(b.time);
      return tb.compareTo(ta);
    });
    final visibleEntries =
        allMerged.length > 20 ? allMerged.take(20).toList() : allMerged;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Gala Dinner',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.hostelName,
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Total Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCourseLogs(context, 'Starters'),
                      child: TotalPill(
                        label: 'Starters',
                        count: _totals['starters'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCourseLogs(context, 'Main Course'),
                      child: TotalPill(
                        label: 'Main',
                        count: _totals['mainCourse'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCourseLogs(context, 'Desserts'),
                      child: TotalPill(
                        label: 'Desserts',
                        count: _totals['desserts'] ?? 0,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Recent Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const Divider(
          color: Color(0xFFE5E7EB),
          height: 1,
        ),
        Expanded(
          child: visibleEntries.isEmpty
              ? const Center(
                  child: Text(
                    'No Gala Dinner scans yet for today.\nNew scans will appear here instantly.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 13,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemCount: visibleEntries.length,
                  itemBuilder: (context, index) {
                    final entry = visibleEntries[index];
                    return GestureDetector(
                      onTap: () async {
                        if (entry.userId.isEmpty) return;
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ManagerUserProfileScreen(
                              userId: entry.userId,
                              authToken: widget.authToken,
                            ),
                          ),
                        );
                        if (mounted && widget.isActive) _fetch();
                      },
                      child: RecentScanCard(entry: entry),
                    );
                  },
                ),
        ),
      ],
    );
  }
}