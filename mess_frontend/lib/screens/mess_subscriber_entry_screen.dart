import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../constants/themes.dart';
import '../providers/auth_controller.dart';
import '../utils/name_case.dart';
import 'manager_user_profile_screen.dart';

class MessSubscriberEntryScreen extends StatefulWidget {
  const MessSubscriberEntryScreen({
    super.key,
    required this.userId,
    required this.name,
    required this.rollNumber,
  });

  final String userId;
  final String name;
  final String rollNumber;

  @override
  State<MessSubscriberEntryScreen> createState() =>
      _MessSubscriberEntryScreenState();
}

class _MessSubscriberEntryScreenState extends State<MessSubscriberEntryScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _status;
  String? _selectedMeal;
  bool _submitting = false;
  bool _didUpdate = false;

  String _initials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.trim().isNotEmpty);
    final letters = parts
        .take(2)
        .map((p) => p.trim().characters.first.toUpperCase())
        .join();
    return letters.isEmpty ? 'S' : letters;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ManagerApi.fetchSubscriberTodayStatus(
        token: token,
        userId: widget.userId,
      );
      if (!mounted) return;
      setState(() {
        _status = data;
        _loading = false;
        _selectedMeal = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  List<String> get _unscannedMeals {
    final scanned = (_status?['scanned'] as Map?) ?? const {};
    final meals = <String>[];
    if (scanned['breakfast'] != true) meals.add('Breakfast');
    if (scanned['lunch'] != true) meals.add('Lunch');
    if (scanned['dinner'] != true) meals.add('Dinner');
    return meals;
  }

  Future<void> _submit() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;
    final meal = _selectedMeal;
    if (meal == null) return;
    if (_status?['onLeaveToday'] == true) return;
    if (_submitting) return;

    setState(() => _submitting = true);
    try {
      final res = await ManagerApi.createScanEntry(
        token: token,
        userId: widget.userId,
        mealType: meal,
      );
      if (!mounted) return;
      final ok = res['success'] == true;
      final msg =
          res['message']?.toString() ??
          (ok ? 'Entry added' : 'Failed to add entry');
      if (ok) _didUpdate = true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            msg,
            style: const TextStyle(color: Colors.white),
          ),
          backgroundColor:
              ok ? const Color(0xFF059669) : const Color(0xFFB91C1C),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          duration: const Duration(milliseconds: 2000),
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Failed. $e',
            style: const TextStyle(color: Colors.white),
          ),
          backgroundColor: const Color(0xFFB91C1C),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          duration: const Duration(milliseconds: 3000),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scanned = (_status?['scanned'] as Map?) ?? const {};
    final onLeave = _status?['onLeaveToday'] == true;
    final scanTimes = (_status?['scanTimes'] as Map?) ?? const {};
    final t = Theme.of(context).textTheme;
    final displayName = widget.name.trim().isEmpty
        ? 'Unknown'
        : toTitleCase(widget.name);
    String timeOrDash(dynamic raw) {
      final s = raw?.toString();
      if (s == null || s.isEmpty || s == 'null') return '—';
      // Accept both ISO strings and pre-formatted values.
      final dt = DateTime.tryParse(s)?.toLocal();
      if (dt == null) return s;
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    }

    return WillPopScope(
      onWillPop: () async {
        Navigator.of(context).pop(_didUpdate);
        return false;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF9FAFB),
        appBar: AppBar(
          automaticallyImplyLeading: false,
          leading: BackButton(
            color: const Color(0xFF111827),
            onPressed: () => Navigator.of(context).pop(_didUpdate),
          ),
          title: const Text(
            'Add Entry',
            style: TextStyle(
              color: Color(0xFF111827),
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          actions: [
            IconButton(
              onPressed: _submitting
                  ? null
                  : () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ManagerUserProfileScreen(
                            userId: widget.userId,
                          ),
                        ),
                      );
                    },
              icon: const Icon(Icons.person_outline, color: Color(0xFF111827)),
              tooltip: 'Profile',
            ),
            IconButton(
              onPressed: _submitting ? null : _load,
              icon: const Icon(Icons.refresh, color: Color(0xFF111827)),
              tooltip: 'Refresh',
            ),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Failed to load status.\n$_error',
                        textAlign: TextAlign.center,
                        style: t.bodyMedium
                            ?.copyWith(color: const Color(0xFFB91C1C)),
                      ),
                    ),
                  )
                : SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFE5E7EB),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: Themes.kAccent.withValues(
                                        alpha: 0.12,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      _initials(displayName),
                                      style: const TextStyle(
                                        color: Themes.kAccent,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          displayName,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: t.titleLarge?.copyWith(
                                            fontWeight: FontWeight.w700,
                                            color: const Color(0xFF111827),
                                            fontSize: 16,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          widget.rollNumber.trim().isEmpty
                                              ? '-'
                                              : widget.rollNumber,
                                          style: t.bodySmall?.copyWith(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: const Color(0xFF6B7280),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF9FAFB),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFE5E7EB),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _StatusCard(
                                    title: 'Leave',
                                    value: onLeave
                                        ? 'On leave'
                                        : 'Not on leave',
                                    subValue: onLeave
                                        ? ((_status?['leave'] as Map?)?['leaveType']
                                                  ?.toString() ??
                                              '')
                                        : null,
                                    tone: onLeave
                                        ? _StatusTone.danger
                                        : _StatusTone.neutral,
                                  ),
                                  const SizedBox(height: 12),
                                  _MealCard(
                                    label: 'Breakfast',
                                    scanned: scanned['breakfast'] == true,
                                    time: timeOrDash(scanTimes['breakfastTime']),
                                  ),
                                  const SizedBox(height: 12),
                                  _MealCard(
                                    label: 'Lunch',
                                    scanned: scanned['lunch'] == true,
                                    time: timeOrDash(scanTimes['lunchTime']),
                                  ),
                                  const SizedBox(height: 12),
                                  _MealCard(
                                    label: 'Dinner',
                                    scanned: scanned['dinner'] == true,
                                    time: timeOrDash(scanTimes['dinnerTime']),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    height: 46,
                                    decoration: BoxDecoration(
                                      color: Themes.shimmerHighlight,
                                      borderRadius: BorderRadius.circular(12),
                                      border:
                                          Border.all(color: Themes.shimmerBase),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                    ),
                                    alignment: Alignment.centerLeft,
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButton<String>(
                                        value: _selectedMeal,
                                        isExpanded: true,
                                        dropdownColor: Colors.white,
                                        icon: const Icon(
                                          Icons.keyboard_arrow_down_rounded,
                                          color: Color(0xFF6B7280),
                                        ),
                                        hint: Text(
                                          'Select meal',
                                          style: t.bodyMedium?.copyWith(
                                            color: const Color(0xFF6B7280),
                                            fontWeight: FontWeight.w600,
                                            fontSize: 13,
                                          ),
                                        ),
                                        items: _unscannedMeals
                                            .map(
                                              (m) => DropdownMenuItem<String>(
                                                value: m,
                                                child: Text(
                                                  m,
                                                  style: t.bodyMedium?.copyWith(
                                                    color: const Color(
                                                      0xFF111827,
                                                    ),
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 13,
                                                  ),
                                                ),
                                              ),
                                            )
                                            .toList(),
                                        onChanged: (onLeave ||
                                                _unscannedMeals.isEmpty ||
                                                _submitting)
                                            ? null
                                            : (v) => setState(
                                                  () => _selectedMeal = v,
                                                ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                SizedBox(
                                  height: 46,
                                  child: FilledButton(
                                    onPressed: (_selectedMeal == null ||
                                            _submitting ||
                                            _unscannedMeals.isEmpty ||
                                            onLeave)
                                        ? null
                                        : _submit,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Themes.kAccent,
                                      disabledBackgroundColor:
                                          const Color(0xFFE5E7EB),
                                      disabledForegroundColor:
                                          const Color(0xFF9CA3AF),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 16,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: _submitting
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Text(
                                            'Submit',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                            ),
                                          ),
                                  ),
                                ),
                              ],
                            ),
                            if (onLeave) ...[
                              const SizedBox(height: 10),
                              Text(
                                'Entry cannot be added because the student is on leave today.',
                                textAlign: TextAlign.center,
                                style: t.bodySmall?.copyWith(
                                  color: const Color(0xFFB91C1C),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                            if (_unscannedMeals.isEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                'All meals already scanned for today.',
                                textAlign: TextAlign.center,
                                style: t.bodySmall,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ),
    );
  }
}

enum _StatusTone { neutral, success, danger }

class _StatusCard extends StatelessWidget {
  final String title;
  final String value;
  final String? subValue;
  final _StatusTone tone;

  const _StatusCard({
    required this.title,
    required this.value,
    required this.tone,
    this.subValue,
  });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    Color color;
    Color bg;
    switch (tone) {
      case _StatusTone.success:
        color = const Color(0xFF059669);
        bg = const Color(0xFFECFDF5);
        break;
      case _StatusTone.danger:
        color = const Color(0xFFB91C1C);
        bg = const Color(0xFFFEE2E2);
        break;
      case _StatusTone.neutral:
        color = const Color(0xFF111827);
        bg = const Color(0xFFF3F4F6);
        break;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: t.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF111827),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: t.bodyMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                if (subValue != null && subValue!.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subValue!,
                    style: t.bodySmall?.copyWith(
                      color: const Color(0xFF6B7280),
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MealCard extends StatelessWidget {
  final String label;
  final bool scanned;
  final String time;

  const _MealCard({
    required this.label,
    required this.scanned,
    required this.time,
  });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final border = scanned ? const Color(0xFF059669) : const Color(0xFFE5E7EB);
    final bg = scanned ? const Color(0xFFECFDF5) : const Color(0xFFF9FAFB);
    final badgeBg = scanned ? const Color(0xFF059669) : const Color(0xFF6B7280);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                  style: t.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF111827),
                    fontSize: 14,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  scanned ? 'Scanned' : 'Pending',
                  style: t.labelSmall?.copyWith(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            scanned ? 'Scanned at: $time' : 'Not scanned yet',
            style: t.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: const Color(0xFF6B7280),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
