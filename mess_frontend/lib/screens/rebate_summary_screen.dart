import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../providers/auth_controller.dart';
import '../utils/rebate_formatting.dart';
import 'rebate_application_detail_screen.dart';

class RebateSummaryScreen extends StatefulWidget {
  const RebateSummaryScreen({super.key, required this.hostelName});

  final String hostelName;

  @override
  State<RebateSummaryScreen> createState() => _RebateSummaryScreenState();
}

class _RebateSummaryScreenState extends State<RebateSummaryScreen> {
  bool _loadingMonths = true;
  String? _monthsError;
  List<MonthYear> _availableMonths = const [];
  MonthYear? _selected;

  bool _loadingApps = false;
  String? _appsError;
  List<Map<String, dynamic>> _apps = const [];

  final Map<MonthYear, List<Map<String, dynamic>>> _monthCache = {};

  @override
  void initState() {
    super.initState();
    _loadAvailableMonths();
  }

  Future<void> _loadAvailableMonths() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;

    setState(() {
      _loadingMonths = true;
      _monthsError = null;
      _availableMonths = const [];
      _selected = null;
      _apps = const [];
      _appsError = null;
    });

    final now = DateTime.now();
    const lookbackMonths = 24;
    final found = <MonthYear>[];
    var hadFetchError = false;

    for (int i = 0; i < lookbackMonths; i++) {
      final d = DateTime(now.year, now.month - i, 1);
      final my = MonthYear(d.month, d.year);
      try {
        final apps = await ManagerApi.fetchMessRebateApplications(
          token: token,
          month: my.month,
          year: my.year,
        );
        if (!mounted) return;
        if (apps.isNotEmpty) {
          _monthCache[my] = apps;
          found.add(my);
        }
      } catch (_) {
        hadFetchError = true;
        if (!mounted) return;
      }
    }

    if (!mounted) return;
    found.sort((a, b) {
      final ad = DateTime(a.year, a.month, 1);
      final bd = DateTime(b.year, b.month, 1);
      return bd.compareTo(ad);
    });

    setState(() {
      _availableMonths = found;
      _selected = found.isNotEmpty ? found.first : null;
      _loadingMonths = false;
      if (found.isEmpty && hadFetchError) {
        _monthsError =
            'Could not load rebate months. Check your connection and tap refresh.';
      }
    });

    if (_selected != null) {
      await _loadApplicationsForSelected();
    }
  }

  Future<void> _loadApplicationsForSelected() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;

    final sel = _selected;
    if (sel == null) return;
    setState(() {
      _loadingApps = true;
      _appsError = null;
    });

    try {
      final cached = _monthCache[sel];
      final apps = cached ??
          await ManagerApi.fetchMessRebateApplications(
            token: token,
            month: sel.month,
            year: sel.year,
          );
      if (!mounted) return;
      _monthCache[sel] = apps;
      setState(() {
        _apps = apps;
        _loadingApps = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _apps = const [];
        _appsError = e.toString();
        _loadingApps = false;
      });
    }
  }

  List<Map<String, dynamic>> _byStatus(String status) {
    final want = status.toLowerCase();
    return _apps
        .where((a) => (a['status'] ?? '').toString().toLowerCase() == want)
        .toList();
  }

  Widget _applicationRow(Map<String, dynamic> a) {
    final user = a['user'] is Map
        ? Map<String, dynamic>.from(a['user'] as Map)
        : const <String, dynamic>{};
    final name = (user['name'] ?? '').toString().trim();
    final roll = (user['rollNumber'] ?? '').toString().trim();
    final type = (a['leaveType'] ?? 'Leave').toString().trim();
    final start = safeParseIsoDate(a['startDate']);
    final end = safeParseIsoDate(a['endDate']);
    final range = (start != null && end != null)
        ? '${formatDdMmm(start)} \u2013 ${formatDdMmm(end)}'
        : '';
    final id = a['_id']?.toString() ?? '';

    return InkWell(
      onTap: id.isEmpty
          ? null
          : () async {
              final didUpdate = await Navigator.of(context).push<bool>(
                MaterialPageRoute<bool>(
                  builder: (_) => RebateApplicationDetailScreen(
                    application: a,
                  ),
                ),
              );
              if (didUpdate == true && mounted) {
                await _loadApplicationsForSelected();
              }
            },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.description_outlined, color: Color(0xFF6B7280)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name.isEmpty ? 'Student' : name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [roll, type, range]
                        .where((s) => s.trim().isNotEmpty)
                        .join(' • '),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Rebate',
          style: TextStyle(
            color: Color(0xFF111827),
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            onPressed: _loadAvailableMonths,
            icon: const Icon(Icons.refresh, color: Color(0xFF111827)),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_loadingMonths)
              const Expanded(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_availableMonths.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _monthsError ??
                          'No mess rebate applications found.',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    if (_monthsError != null) ...[
                      const SizedBox(height: 12),
                      TextButton.icon(
                        onPressed: _loadAvailableMonths,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ],
                  ],
                ),
              )
            else ...[
              const Text(
                'Month',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: DropdownButton<MonthYear>(
                  value: _selected,
                  isExpanded: true,
                  underline: const SizedBox.shrink(),
                  items: _availableMonths
                      .map(
                        (m) => DropdownMenuItem<MonthYear>(
                          value: m,
                          child: Text(monthYearLabel(m)),
                        ),
                      )
                      .toList(),
                  onChanged: (v) async {
                    if (v == null) return;
                    setState(() {
                      _selected = v;
                    });
                    await _loadApplicationsForSelected();
                  },
                ),
              ),
            ],
            if (_monthsError != null && _availableMonths.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _monthsError!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            if (!_loadingMonths) ...[
              const SizedBox(height: 12),
              Expanded(
                child: _loadingApps
                    ? const Center(child: CircularProgressIndicator())
                    : (_appsError != null
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Failed to load applications.\n$_appsError',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Color(0xFFB91C1C),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextButton.icon(
                                  onPressed: _loadApplicationsForSelected,
                                  icon: const Icon(Icons.refresh),
                                  label: const Text('Retry'),
                                ),
                              ],
                            ),
                          )
                        : Builder(
                            builder: (context) {
                              final pending = _byStatus('Pending');
                              final ack = _byStatus('Acknowledged');
                              return DefaultTabController(
                                length: 2,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Container(
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius:
                                            BorderRadius.circular(12),
                                        border: Border.all(
                                          color: const Color(0xFFE5E7EB),
                                        ),
                                      ),
                                      child: TabBar(
                                        labelColor: const Color(0xFF111827),
                                        unselectedLabelColor:
                                            const Color(0xFF6B7280),
                                        labelStyle: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                        indicator: BoxDecoration(
                                          color: const Color(0xFFEFF6FF),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                        ),
                                        indicatorSize:
                                            TabBarIndicatorSize.tab,
                                        dividerColor: Colors.transparent,
                                        tabs: [
                                          Tab(
                                            text:
                                                'Pending (${pending.length})',
                                          ),
                                          Tab(
                                            text:
                                                'Acknowledged (${ack.length})',
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    Expanded(
                                      child: TabBarView(
                                        children: [
                                          pending.isEmpty
                                              ? const Center(
                                                  child: Text(
                                                    'No pending applications for this month.',
                                                    textAlign:
                                                        TextAlign.center,
                                                    style: TextStyle(
                                                      color:
                                                          Color(0xFF6B7280),
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                )
                                              : ListView(
                                                  children: pending
                                                      .map(_applicationRow)
                                                      .toList(),
                                                ),
                                          ack.isEmpty
                                              ? const Center(
                                                  child: Text(
                                                    'No acknowledged applications for this month.',
                                                    textAlign:
                                                        TextAlign.center,
                                                    style: TextStyle(
                                                      color:
                                                          Color(0xFF6B7280),
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                )
                                              : ListView(
                                                  children: ack
                                                      .map(_applicationRow)
                                                      .toList(),
                                                ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          )),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
