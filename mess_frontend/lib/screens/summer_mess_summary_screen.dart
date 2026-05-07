import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../providers/auth_controller.dart';
import '../utils/name_case.dart';
import 'summer_mess_application_detail_screen.dart';

class SummerMessSummaryScreen extends StatefulWidget {
  const SummerMessSummaryScreen({super.key, required this.hostelName});

  final String hostelName;

  @override
  State<SummerMessSummaryScreen> createState() =>
      _SummerMessSummaryScreenState();
}

class _SummerMessSummaryScreenState extends State<SummerMessSummaryScreen> {
  bool _loading = true;
  String? _error;
  String _selectedStatus = 'Pending';
  List<Map<String, dynamic>> _applications = const [];
  String _seasonLabel = '';

  @override
  void initState() {
    super.initState();
    _loadApplications();
  }

  Future<void> _loadApplications() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final payload = await ManagerApi.fetchSummerMessApplications(
        token: token,
        status: _selectedStatus,
      );
      if (!mounted) return;
      setState(() {
        _applications = payload.applications;
        _seasonLabel = payload.seasonLabel;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _applications = const [];
        _seasonLabel = '';
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Widget _applicationRow(Map<String, dynamic> app) {
    final user = app['user'] is Map
        ? Map<String, dynamic>.from(app['user'] as Map)
        : const <String, dynamic>{};

    return InkWell(
      onTap: () async {
        final didUpdate = await Navigator.of(context).push<bool>(
          MaterialPageRoute<bool>(
            builder: (_) => SummerMessApplicationDetailScreen(application: app),
          ),
        );
        if (didUpdate == true && mounted) {
          await _loadApplications();
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
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.wb_sunny_outlined,
                color: Color(0xFF475569),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    toTitleCase((user['name'] ?? '').toString()),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      (user['rollNumber'] ?? '').toString().trim(),
                    ].where((s) => s.isNotEmpty).join(' • '),
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
          'Summer Mess',
          style: TextStyle(
            color: Color(0xFF111827),
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedStatus,
                icon: const Icon(
                  Icons.keyboard_arrow_down,
                  color: Color(0xFF111827),
                ),
                style: const TextStyle(
                  color: Color(0xFF111827),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
                items: const [
                  DropdownMenuItem(value: 'Pending', child: Text('Pending')),
                  DropdownMenuItem(
                    value: 'Acknowledged',
                    child: Text('Acknowledged'),
                  ),
                ],
                onChanged: (value) {
                  if (value == null || value == _selectedStatus) return;
                  setState(() {
                    _selectedStatus = value;
                  });
                  _loadApplications();
                },
              ),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_seasonLabel.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _seasonLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  Text(
                    'Total: ${_applications.length}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                  ? Center(
                      child: Text(
                        'Failed to load summer mess applications.\n$_error',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    )
                  : _applications.isEmpty
                  ? Center(
                      child: Text(
                        _selectedStatus == 'Pending'
                            ? 'No pending summer mess applications.'
                            : _selectedStatus == 'Acknowledged'
                            ? 'No acknowledged summer mess applications.'
                            : 'No summer mess applications found.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    )
                  : ListView(
                      children: _applications.map(_applicationRow).toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
