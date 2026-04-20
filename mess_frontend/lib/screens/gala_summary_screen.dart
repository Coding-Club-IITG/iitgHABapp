import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../models/recent_entry.dart';
import '../providers/auth_controller.dart';
import '../utils/scan_time.dart';
import '../widgets/error_state.dart';
import '../widgets/recent_scan_card.dart';
import '../widgets/total_pill.dart';
import 'gala_course_scan_logs_screen.dart';
import 'manager_user_profile_screen.dart';

class GalaSummaryScreen extends StatefulWidget {
  const GalaSummaryScreen({super.key, required this.hostelName});

  final String hostelName;

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

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _openCourseLogs(BuildContext context, String course) async {
    _timer?.cancel();
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => GalaCourseScanLogsScreen(course: course),
      ),
    );
    if (mounted) {
      _startTimer();
      _fetch();
    }
  }

  @override
  void initState() {
    super.initState();
    _fetch();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;
    try {
      final data = await ManagerApi.fetchGalaSummary(token);
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

      List<RecentEntry> starters = mapRecentFromApi(recentMap['starters']);
      List<RecentEntry> main = mapRecentFromApi(recentMap['mainCourse']);
      List<RecentEntry> desserts = mapRecentFromApi(recentMap['desserts']);

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
      return ErrorStateWidget(
        message: 'Failed to load Gala Dinner scans.\n$_error',
        onRetry: _fetch,
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
                      onTap: () {
                        if (entry.userId.isEmpty) return;
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => ManagerUserProfileScreen(
                              userId: entry.userId,
                            ),
                          ),
                        );
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
