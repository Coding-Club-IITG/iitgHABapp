import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart'; // Replaced url_launcher
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

    try {
      final apps = await LeaveApi.fetchPendingApplications(widget.authToken);
      if (!mounted) return;
      setState(() {
        _applications = apps;
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

  Future<void> _handleAction(String id, bool isApprove) async {
    final TextEditingController feedbackController = TextEditingController();

    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          title: Text(
            isApprove ? 'Approve Application' : 'Reject Application',
            style: const TextStyle(color: Colors.black87),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                isApprove
                    ? 'Are you sure you want to approve this leave?'
                    : 'Are you sure you want to reject this leave?',
                style: const TextStyle(color: Colors.black87),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: feedbackController,
                style: const TextStyle(color: Colors.black87, fontSize: 14),
                cursorColor: Colors.blue,
                decoration: InputDecoration(
                  labelText: 'Feedback (Optional)',
                  labelStyle: const TextStyle(color: Colors.black54),
                  hintText: 'Add a note for the student...',
                  hintStyle: const TextStyle(color: Colors.black38),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Colors.blue, width: 1.5),
                  ),
                ),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              style: TextButton.styleFrom(foregroundColor: Colors.grey.shade700),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: isApprove ? Colors.green : Colors.red,
                foregroundColor: Colors.white,
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
      final feedback = feedbackController.text.trim();

      if (isApprove) {
        await LeaveApi.approveApplication(
          token: widget.authToken,
          applicationId: id,
          feedback: feedback.isNotEmpty ? feedback : null,
        );
      } else {
        await LeaveApi.rejectApplication(
          token: widget.authToken,
          applicationId: id,
          feedback: feedback.isNotEmpty ? feedback : null,
        );
      }

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

  Future<void> _viewDocument(String? urlString) async {
    if (urlString == null || urlString.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No document attached.')),
      );
      return;
    }

    // Show a loading indicator while the file downloads
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Center(
        child: Container(
            padding: EdgeInsets.all(20),
            decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
          ),
          child: CircularProgressIndicator(),
        ),
      ),
    );

    try {
      // Fetch and save the file to local storage
      final file = await LeaveApi.downloadProofDocument(
        token: widget.authToken,
        documentUrl: urlString,
      );

      if (!mounted) return;
      Navigator.pop(context); // Close the loading dialog

      // Command the OS to open the file with the default PDF/Image viewer
      final result = await OpenFilex.open(file.path);
      
      if (result.type != ResultType.done && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open file: ${result.message}')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // Close the loading dialog
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to download document: $e')),
      );
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

  (Color, Color) _getLeaveTypeColors(String type) {
    final lowerType = type.toLowerCase();
    if (lowerType.contains('medical')) {
      return (const Color(0xFFF3E8FF), const Color(0xFF7E22CE)); 
    } else if (lowerType.contains('academic')) {
      return (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8)); 
    } else if (lowerType.contains('personal') || lowerType.contains('casual')) {
      return (const Color(0xFFFFEDD5), const Color(0xFFC2410C)); 
    }
    return (const Color(0xFFF3F4F6), const Color(0xFF4B5563)); 
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
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Leave Requests',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_applications.length} Pending',
                  style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _applications.isEmpty
              ? const EmptyState(message: 'No pending leave applications.')
              : RefreshIndicator(
                  onRefresh: _fetchApplications,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _applications.length,
                    itemBuilder: (context, index) {
                      final app = _applications[index];
                      final user = app['user'] ?? {};
                      final docUrl = app['proofDocumentUrl'] as String?;
                      final leaveType = app['leaveType'] ?? 'Unknown';
                      final typeColors = _getLeaveTypeColors(leaveType);

                      return Card(
                        elevation: 1,
                        margin: const EdgeInsets.only(bottom: 16),
                        color: Colors.white,
                        surfaceTintColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: Colors.grey.shade200),
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
                                    child: RichText(
                                      text: TextSpan(
                                        style: const TextStyle(
                                          fontSize: 15,
                                          color: Colors.black,
                                        ),
                                        children: [
                                          const TextSpan(
                                            text: 'Student: ',
                                            style: TextStyle(fontWeight: FontWeight.w800),
                                          ),
                                          TextSpan(
                                            text: user['name'] ?? 'Unknown User',
                                            style: const TextStyle(fontWeight: FontWeight.w500),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: typeColors.$1,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      leaveType,
                                      style: TextStyle(
                                        color: typeColors.$2,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              RichText(
                                text: TextSpan(
                                  style: const TextStyle(
                                    fontSize: 15,
                                    color: Colors.black,
                                  ),
                                  children: [
                                    const TextSpan(
                                      text: 'Roll No: ',
                                      style: TextStyle(fontWeight: FontWeight.w800),
                                    ),
                                    TextSpan(
                                      text: user['rollNumber'] ?? 'N/A',
                                      style: const TextStyle(fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(Icons.calendar_month_rounded, size: 16, color: Colors.grey.shade800),
                                  const SizedBox(width: 8),
                                  RichText(
                                    text: TextSpan(
                                      style: const TextStyle(
                                        fontSize: 15,
                                        color: Colors.black,
                                      ),
                                      children: [
                                        const TextSpan(
                                          text: 'Dates: ',
                                          style: TextStyle(fontWeight: FontWeight.w800),
                                        ),
                                        TextSpan(
                                          text: '${_formatDate(app['startDate'])} - ${_formatDate(app['endDate'])}',
                                          style: const TextStyle(fontWeight: FontWeight.w500),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              
                              // --- UPDATED ACTION BUTTONS LAYOUT ---
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  // View Document on its own row
                                  if (docUrl != null) ...[
                                    Align(
                                      alignment: Alignment.centerLeft,
                                      child: InkWell(
                                        onTap: () => _viewDocument(docUrl),
                                        borderRadius: BorderRadius.circular(8),
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(Icons.description_outlined, size: 18, color: Colors.grey.shade800),
                                              const SizedBox(width: 6),
                                              Text(
                                                'View Document',
                                                style: TextStyle(
                                                  color: Colors.grey.shade800,
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                  ],
                                  
                                  // Accept and Reject taking up equal space on the bottom row
                                  Row(
                                    children: [
                                      Expanded(
                                        child: TextButton(
                                          onPressed: () => _handleAction(app['_id'], false),
                                          style: TextButton.styleFrom(
                                            backgroundColor: const Color(0xFFFEE2E2), 
                                            foregroundColor: const Color(0xFFB91C1C), 
                                            padding: const EdgeInsets.symmetric(vertical: 12),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                          ),
                                          child: const Text(
                                            'Reject',
                                            style: TextStyle(fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: TextButton(
                                          onPressed: () => _handleAction(app['_id'], true),
                                          style: TextButton.styleFrom(
                                            backgroundColor: const Color(0xFFDCFCE7), 
                                            foregroundColor: const Color(0xFF15803D), 
                                            padding: const EdgeInsets.symmetric(vertical: 12),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                          ),
                                          child: const Text(
                                            'Approve',
                                            style: TextStyle(fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ),
                                    ],
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