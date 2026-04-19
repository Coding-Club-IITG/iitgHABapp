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
import 'manager_user_profile_screen.dart';
import 'mess_meal_scan_logs_screen.dart';

class TodayMessScreen extends StatefulWidget {
  const TodayMessScreen({super.key, required this.hostelName});

  final String hostelName;

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

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _openMealLogs(BuildContext context, String meal) async {
    _timer?.cancel();
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MessMealScanLogsScreen(meal: meal),
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
      final data = await ManagerApi.fetchTodayMessSummary(token);
      final recentMap =
          (data['recent'] as Map<String, dynamic>? ?? <String, dynamic>{});

      final totalsMap =
          (data['totals'] as Map<String, dynamic>? ?? <String, dynamic>{});

      List<RecentEntry> breakfast = mapRecentFromApi(recentMap['breakfast']);
      List<RecentEntry> lunch = mapRecentFromApi(recentMap['lunch']);
      List<RecentEntry> dinner = mapRecentFromApi(recentMap['dinner']);

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
      return ErrorStateWidget(
        message: 'Failed to load today\'s scans.\n$_error',
        onRetry: _fetch,
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
                          : () {
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
