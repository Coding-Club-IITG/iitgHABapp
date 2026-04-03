import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart'; // Add this import
import '../../apis/leave_api.dart';
import '../widgets/shared_widgets.dart';

class LeaveApplicationsScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const LeaveApplicationsScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  State<LeaveApplicationsScreen> createState() =>
      _LeaveApplicationsScreenState();
}

class _LeaveApplicationsScreenState extends State<LeaveApplicationsScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _applications = [];

  @override
  void initState() {
    super.initState();
    _fetchApplications();
  }

  Future<void> _fetchApplications() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    // Dummy data with a fake delay. Swap with your API call when ready.
    await Future.delayed(const Duration(milliseconds: 800));

    if (!mounted) return;

    setState(() {
      _applications = [
        {
          '_id': 'dummy_1',
          'user': {
            'name': 'Abhinav Rai',
            'rollNumber': '220101000',
          },
          'leaveType': 'Medical',
          'startDate': '2026-04-10T00:00:00.000Z',
          'endDate': '2026-04-15T00:00:00.000Z',
          'proofDocumentUrl': 'https://google.com',
        },
        {
          '_id': 'dummy_2',
          'user': {
            'name': 'Rahul Sharma',
            'rollNumber': '220101045',
          },
          'leaveType': 'Academic',
          'startDate': '2026-04-18T00:00:00.000Z',
          'endDate': '2026-04-22T00:00:00.000Z',
          'proofDocumentUrl': null,
        },
      ];
      _loading = false;
    });
  }

  Future<void> _handleAction(String id, bool isApprove) async {
    final TextEditingController feedbackController = TextEditingController();

    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(isApprove ? 'Approve Application' : 'Reject Application'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                isApprove
                    ? 'Are you sure you want to approve this leave?'
                    : 'Are you sure you want to reject this leave?',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: feedbackController,
                decoration: const InputDecoration(
                  labelText: 'Feedback (Optional)',
                  hintText: 'Add a note for the student...',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: isApprove ? Colors.green : Colors.red,
                foregroundColor: Colors.white, // <-- ADD THIS LINE to fix text visibility
              ),
              child: Text(isApprove ? 'Approve' : 'Reject'),
            ),
          ],
        );
      },
    );

    if (confirm != true || !mounted) return;

    setState(() => _loading = true);

    try {
      // Dummy delay for UI testing, replace with actual API call later
      await Future.delayed(const Duration(milliseconds: 600));

      setState(() {
        _applications.removeWhere((app) => app['_id'] == id);
        _loading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isApprove ? 'Application approved.' : 'Application rejected.',
            ),
            backgroundColor: isApprove ? Colors.green : Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to process: $e')),
      );
    }
  }

  // Updated to launch URL in the external browser
  Future<void> _viewDocument(String? urlString) async {
    if (urlString == null || urlString.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No document attached.')),
      );
      return;
    }

    final Uri url = Uri.parse(urlString);
    try {
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw Exception('Could not launch $url');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open document: $e')),
        );
      }
    }
  }

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return isoString;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _applications.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _applications.isEmpty) {
      return ErrorState(message: 'Failed to load applications.\n$_error');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Leave Applications',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Pending requests for ${widget.hostelName}',
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
        const Divider(color: Color(0xFFE5E7EB), height: 1),
        Expanded(
          child: _applications.isEmpty
              ? const EmptyState(message: 'No pending leave applications.')
              : RefreshIndicator(
                  onRefresh: _fetchApplications,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _applications.length,
                    itemBuilder: (context, index) {
                      final app = _applications[index];
                      final user = app['user'] ?? {};
                      final docUrl = app['proofDocumentUrl'] as String?;

                      return Card(
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: Color(0xFFE5E7EB)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      user['name'] ?? 'Unknown User',
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE0E7FF),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      app['leaveType'] ?? 'Unknown',
                                      style: const TextStyle(
                                        color: Color(0xFF4338CA),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Roll No: ${user['rollNumber'] ?? 'N/A'}',
                                style: const TextStyle(
                                  color: Color(0xFF6B7280),
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  const Icon(Icons.calendar_today,
                                      size: 14, color: Color(0xFF6B7280)),
                                  const SizedBox(width: 6),
                                  Text(
                                    '${_formatDate(app['startDate'])}  -  ${_formatDate(app['endDate'])}',
                                    style: const TextStyle(
                                      color: Color(0xFF111827),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  if (docUrl != null)
                                    Expanded(
                                      flex: 4, // Gives slightly more room to the button with an icon
                                      child: OutlinedButton.icon(
                                        onPressed: () => _viewDocument(docUrl),
                                        icon: const Icon(Icons.insert_drive_file_outlined, size: 16),
                                        label: const FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Text('View Doc'),
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: const Color(0xFF4C4EDB),
                                          padding: const EdgeInsets.symmetric(horizontal: 4),
                                        ),
                                      ),
                                    ),
                                  if (docUrl != null) const SizedBox(width: 8),
                                  Expanded(
                                    flex: 3,
                                    child: ElevatedButton(
                                      onPressed: () => _handleAction(app['_id'], false),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFFFEF2F2),
                                        foregroundColor: const Color(0xFFDC2626),
                                        elevation: 0,
                                        padding: const EdgeInsets.symmetric(horizontal: 4),
                                      ),
                                      child: const FittedBox(
                                        fit: BoxFit.scaleDown,
                                        child: Text('Reject'),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    flex: 3,
                                    child: ElevatedButton(
                                      onPressed: () => _handleAction(app['_id'], true),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFFF0FDF4),
                                        foregroundColor: const Color(0xFF16A34A),
                                        elevation: 0,
                                        padding: const EdgeInsets.symmetric(horizontal: 4),
                                      ),
                                      child: const FittedBox(
                                        fit: BoxFit.scaleDown,
                                        child: Text('Approve'),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}