import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/utils/api_error_message.dart';
import 'package:frontend2/screens/immediate_leave_form_screen.dart';
import 'package:frontend2/screens/leave_application_screen.dart';
import 'package:frontend2/screens/rebate_application_status_screen.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';
import 'package:intl/intl.dart';
import 'package:flutter_svg/flutter_svg.dart';

class LeaveApplicationListScreen extends StatefulWidget {
  const LeaveApplicationListScreen({super.key});

  @override
  State<LeaveApplicationListScreen> createState() =>
      _LeaveApplicationListScreenState();
}

Widget _LeaveTypeCard(
    String title, String description, String icon, VoidCallback onTap) {
  return GestureDetector(
    onTap: onTap,
    child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE6E6E6)),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            height: 24,
            // decoration: BoxDecoration(
            //   color: const Color(0xFF4C4EDB).withOpacity(0.1),
            //   borderRadius: BorderRadius.circular(18),
            // ),
            child: SvgPicture.asset(
              icon,
              color: const Color(0xFF4C4EDB),
              width: 24,
              height: 24,
            ),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF2E2F31),
                  ),
                ),
                if (description.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF2E2F31),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFF4C4EDB)),
        ],
      ),
    ),
  );
}

Widget _leaveTypeCardSkeleton(ShimmerBoxBuilder box) {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE6E6E6)),
      borderRadius: BorderRadius.circular(12),
    ),
    padding: const EdgeInsets.all(16),
    child: Row(
      children: [
        box(height: 24, width: 24, borderRadius: BorderRadius.circular(6)),
        const SizedBox(width: 24),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              box(height: 16, width: 120),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: box(
                  height: 12,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(height: 6),
              box(height: 12, width: 220),
            ],
          ),
        ),
        box(height: 18, width: 18, borderRadius: BorderRadius.circular(4)),
      ],
    ),
  );
}

class _LeaveApplicationListScreenState
    extends State<LeaveApplicationListScreen> {
  var myApplications = [];
  bool isLoading = true;
  String selectedTab = 'All';
  final List<String> filterTabs = [
    'All',
    'Pending',
    'Acknowledged',
    'Processed',
    'Cancelled',
  ];

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    final accessToken = await getAccessToken();
    if (accessToken == 'error') {
      setState(() {
        isLoading = false;
      });
      return;
    }
    try {
      final dio = DioClient().dio;
      final response = await dio.get(
        MessRebateEndpoints.getApplications,
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      if (response.statusCode == 200) {
        final data = response.data as Map;
        setState(() {
          myApplications = data['myApplications'] ?? [];
          isLoading = false;
        });
      } else {
        setState(() {
          isLoading = false;
        });
      }
    } catch (err) {
      setState(() {
        isLoading = false;
      });
    }
  }

  // Future<void> _deleteApplication(String applicationId) async {
  //   try {
  //     final accessToken = await getAccessToken();
  //     if (accessToken == 'error') {
  //       ScaffoldMessenger.of(context).showSnackBar(
  //         const SnackBar(content: Text('Error deleting application')),
  //       );
  //       return;
  //     }
  //     final dio = DioClient().dio;
  //     final response = await dio.delete(
  //       '${MessRebateEndpoints.getApplications}/$applicationId',
  //       options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
  //     );
  //     if (response.statusCode == 200) {
  //       setState(() {
  //         myApplications.removeWhere((app) => app['_id'] == applicationId);
  //       });
  //       ScaffoldMessenger.of(context).showSnackBar(
  //         const SnackBar(content: Text('Application deleted successfully')),
  //       );
  //       await _fetchHistory();
  //     }
  //   } catch (e) {
  //     ScaffoldMessenger.of(context).showSnackBar(
  //       const SnackBar(content: Text('Error deleting application')),
  //     );
  //   }
  // }

  Future<bool> _cancelApplicationWithConfirm(String applicationId) async {
    try {
      final accessToken = await getAccessToken();
      if (accessToken == 'error') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error cancelling application')),
        );
        return false;
      }
      final dio = DioClient().dio;
      final response = await dio.delete(
        '${MessRebateEndpoints.getApplications}/$applicationId',
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        final ids = <String>{};
        if (data is Map && data['cancelledIds'] is List) {
          for (final e in data['cancelledIds'] as List) {
            ids.add(e.toString());
          }
        } else {
          ids.add(applicationId);
        }
        setState(() {
          myApplications.removeWhere(
            (app) => ids.contains(app['_id']?.toString()),
          );
        });
        final msg = data is Map && data['message'] is String
            ? data['message'] as String
            : 'Application cancelled successfully';
        if (!mounted) return true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
        await _fetchHistory();
        return true;
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to cancel application')),
        );
        return false;
      }
    } catch (e) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            userFacingApiError(
              e,
              fallback: 'Could not cancel. Please try again.',
            ),
          ),
        ),
      );
      return false;
    }
  }

  List<dynamic> _getFilteredApplications() {
    if (selectedTab == 'All') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() != 'cancelled')
          .toList();
    } else if (selectedTab == 'Pending') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'pending')
          .toList();
    } else if (selectedTab == 'Acknowledged') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'acknowledged')
          .toList();
    } else if (selectedTab == 'Processed') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'processed')
          .toList();
    } else if (selectedTab == 'Cancelled') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'cancelled')
          .toList();
    }
    return myApplications;
  }

  int _getTabCount(String tab) {
    if (tab == 'All') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() != 'cancelled')
          .length;
    } else if (tab == 'Pending') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'pending')
          .length;
    } else if (tab == 'Acknowledged') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'acknowledged')
          .length;
    } else if (tab == 'Processed') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'processed')
          .length;
    } else if (tab == 'Cancelled') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'cancelled')
          .length;
    }
    return 0;
  }

  Widget _pastApplicationCard(Map<String, dynamic> application) {
    final applicationId = application['_id']?.toString() ?? '';
    final status = (application['status'] ?? '').toString().toLowerCase();
    final grey = _pastApplicationRow(
      application: application,
      backgroundColor: const Color(0xFFF5F5F5),
    );
    final white = _pastApplicationRow(
      application: application,
      backgroundColor: Colors.white,
    );
    if (status == 'pending') {
      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        child: NativeSwipeToReveal(
          applicationId: applicationId,
          contentChild: white,
          onConfirmDelete: _showConfirmDeleteDialog,
          child: grey,
        ),
      );
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: grey,
    );
  }

  Widget _pastApplicationRow({
    required Map<String, dynamic> application,
    required Color backgroundColor,
  }) {
    final applicationId = application['_id']?.toString() ?? '';
    final rowStatus = (application['status'] ?? '').toString().toLowerCase();
    final startIso = application['startDate']?.toString() ?? '';
    final endIso = application['endDate']?.toString() ?? '';
    final leaveType = application['leaveType']?.toString() ?? 'Leave';
    final startDate = DateFormat('dd MMM').format(
      DateTime.parse(startIso).add(const Duration(days: 1)),
    );
    final endDate = DateFormat('dd MMM').format(
      DateTime.parse(endIso).add(const Duration(days: 1)),
    );
    IconData leaveIcon = Icons.note_outlined;
    if (leaveType.toLowerCase().contains('academic')) {
      leaveIcon = Icons.card_membership_outlined;
    } else if (leaveType.toLowerCase().contains('medical')) {
      leaveIcon = Icons.health_and_safety_outlined;
    }
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width - 32,
        ),
        decoration: BoxDecoration(
          color: backgroundColor,
          border: Border.all(color: const Color(0xFFE6E6E6)),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        child: Row(
          children: [
            Icon(leaveIcon, size: 22, color: const Color(0xFF535353)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    leaveType,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF2E2F31),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$startDate – $endDate',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF676767),
                    ),
                  ),
                ],
              ),
            ),
            if (rowStatus == 'cancelled')
              Text(
                'Cancelled',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade500,
                ),
              )
            else
              TextButton(
                onPressed: () async {
                  await Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => RebateApplicationStatusScreen(
                        applicationId: applicationId,
                        listSnapshot: application,
                        onUpdated: _fetchHistory,
                      ),
                    ),
                  );
                },
                child: const Text('View Status'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      // extendBodyBehindAppBar: true,
      appBar: AppBar(
        scrolledUnderElevation: 0,
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleSpacing: NavigationToolbar.kMiddleSpacing,
        shape: const Border(
          bottom: BorderSide(
            color: Color(0xFFE6E6E6), // Matches your card borders perfectly
            width: 1, // Thickness of the border
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text(
          "Mess Rebate",
          style: TextStyle(
              color: Colors.black, fontWeight: FontWeight.w500, fontSize: 20),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pop(
              context,
            );
          },
        ),
      ),
      body: isLoading
          ? ShimmerHost(
              builder: (context, box) => SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 32, 16, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      box(height: 18, width: 200),
                      const SizedBox(height: 20),
                      _leaveTypeCardSkeleton(box),
                      const SizedBox(height: 16),
                      _leaveTypeCardSkeleton(box),
                      const SizedBox(height: 16),
                      _leaveTypeCardSkeleton(box),
                      const SizedBox(height: 36),
                      box(height: 16, width: 160),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: box(
                          height: 14,
                          width: double.infinity,
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      const SizedBox(height: 8),
                      box(height: 14, width: 280),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: box(
                          height: 48,
                          width: double.infinity,
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // "Want to take a leave?" Section
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Want to take a leave?",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF676767),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 0),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: SvgPicture.asset(
                                  'assets/icon/info-circle.svg',
                                  width: 16,
                                  height: 16,
                                  color: const Color(0xFF2E2F31),
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  "Mess rebate requires applying at least 2 days in advance for casual leave and 1 day in advance for other types of leave.",
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF535353),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        _LeaveTypeCard(
                          "Casual",
                          "Short, unforeseen personal work or urgent errands.",
                          'assets/icon/notes.svg',
                          () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(
                                  leaveType: 1,
                                ),
                              ),
                            );

                            if (result == true) {
                              _fetchHistory();
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        _LeaveTypeCard(
                          "Academic",
                          "Research, field trips, or attending conferences/competitions.",
                          'assets/icon/file-certificate.svg',
                          () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(
                                  leaveType: 2,
                                ),
                              ),
                            );

                            if (result == true) {
                              _fetchHistory();
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        _LeaveTypeCard(
                          "Medical",
                          "Recovery from illness or injury.",
                          'assets/icon/report-medical.svg',
                          () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(
                                  leaveType: 3,
                                ),
                              ),
                            );

                            if (result == true) {
                              _fetchHistory();
                            }
                          },
                        ),
                        // const SizedBox(height: 16),
                      ],
                    ),
                  ),
                  // Divider
                  Container(
                    height: 8,
                    color: const Color(0xFFF0F0F0),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Info box
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: SvgPicture.asset(
                                'assets/icon/info-circle.svg',
                                width: 16,
                                height: 16,
                                color: const Color(0xFF2E2F31),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                "If you don't want a rebate and want to generate a leave form immediately then please fill the form below.",
                                style: TextStyle(
                                  fontSize: 14,
                                  height: 1.4,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF535353),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _LeaveTypeCard(
                          'Generate Leave Form',
                          '',
                          'assets/icon/file-upload.svg',
                          () {
                            Navigator.push<void>(
                              context,
                              MaterialPageRoute<void>(
                                builder: (context) =>
                                    const ImmediateLeaveFormScreen(),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  // Divider
                  Container(
                    height: 8,
                    color: const Color(0xFFF0F0F0),
                  ),
                  // Past rebate applications list
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "View past rebate applications",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF676767),
                          ),
                        ),
                        const SizedBox(height: 16),
                        // Filter tabs
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: filterTabs.map((tab) {
                              bool isSelected = selectedTab == tab;
                              int count = _getTabCount(tab);
                              String tabLabel = '$tab ($count)';
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      selectedTab = tab;
                                    });
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? const Color(0xFFEDEDFB)
                                          : Colors.white,
                                      border: Border.all(
                                        color: isSelected
                                            ? Colors.transparent
                                            : const Color(0xFFE6E6E6),
                                      ),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      tabLabel,
                                      // maxLines: 1,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        color: isSelected
                                            ? const Color(0xFF4C4EDB)
                                            : const Color(0xFF535353),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        // Leave records list
                        Builder(
                          builder: (context) {
                            final filteredApplications =
                                _getFilteredApplications();
                            if (filteredApplications.isEmpty) {
                              return Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const SizedBox(height: 40),
                                    Icon(
                                      Icons.assignment_outlined,
                                      size: 80,
                                      color: Colors.grey[400],
                                    ),
                                    const SizedBox(height: 20),
                                    const Text(
                                      "No leaves found",
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w500,
                                        color: Colors.black54,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    const Text(
                                      "Your leave history will appear here.",
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.black38,
                                      ),
                                    ),
                                    const SizedBox(height: 40),
                                  ],
                                ),
                              );
                            }
                            return ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: filteredApplications.length,
                              itemBuilder: (context, index) {
                                final map = Map<String, dynamic>.from(
                                  filteredApplications[index] as Map,
                                );
                                return _pastApplicationCard(map);
                              },
                            );
                          },
                        )
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  Future<bool> _showConfirmDeleteDialog(
      String applicationId, Widget cardContent) async {
    final bool? shouldDelete = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          backgroundColor: Colors.white,
          child: Padding(
            padding:
                const EdgeInsets.only(top: 12, left: 16, right: 16, bottom: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  alignment: Alignment.centerLeft,
                  child: const Text(
                    'Do you want to cancel?',
                    style: TextStyle(
                      color: Color(0xFF676767), // Grey-1
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      height: 1.50,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Your injected custom card content
                cardContent,

                const SizedBox(height: 10),

                // 2. Fixed Row layout using Expanded widgets
                Row(
                  children: [
                    // Cancel Button (Moved to the left, which is standard UI practice)
                    Expanded(
                      flex: 2,
                      child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            // Adding a subtle border matches your card design perfectly
                            side: const BorderSide(color: Color(0xFFE6E6E6)),
                          ),
                          onPressed: () {
                            Navigator.pop(context, false);
                          },
                          child: const Text(
                            'Go back',
                            style: TextStyle(
                              color:
                                  Color(0xFF4B4EDA) /* Brand-Primary */,
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              height: 1.50,
                            ),
                          )),
                    ),
                    const SizedBox(width: 8), // Nice spacing between buttons
                    // Delete Button
                    Expanded(
                      flex: 3,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        onPressed: () {
                          Navigator.pop(context, true);
                        },
                        child: const Text(
                          "Yes",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
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
    );

    if (shouldDelete == true) {
      return await _cancelApplicationWithConfirm(applicationId);
    }

    return false;
  }
}

class NativeSwipeToReveal extends StatefulWidget {
  final Widget child;
  final Widget contentChild;
  final String applicationId;
  // We pass your existing dialog function in here
  final Future<bool> Function(String id, Widget card) onConfirmDelete;

  const NativeSwipeToReveal({
    super.key,
    required this.child,
    required this.contentChild,
    required this.applicationId,
    required this.onConfirmDelete,
  });

  @override
  State<NativeSwipeToReveal> createState() => _NativeSwipeToRevealState();
}

class _NativeSwipeToRevealState extends State<NativeSwipeToReveal> {
  double _dragExtent = 0.0;
  // 60 pixels gives enough room for your 24px SVG and 20px padding!
  final double _maxDrag = 60.0;

  void _onDragUpdate(DragUpdateDetails details) {
    setState(() {
      _dragExtent += details.primaryDelta!;
      if (_dragExtent > 0) _dragExtent = 0; // Prevents dragging to the right
      if (_dragExtent < -_maxDrag) {
        _dragExtent = -_maxDrag; // Stops exactly at 60px
      }
    });
  }

  void _onDragEnd(DragEndDetails details) async {
    // If they dragged more than halfway, snap it open and show the dialog
    if (_dragExtent < -(_maxDrag / 2)) {
      setState(() {
        _dragExtent = -_maxDrag; // Snap fully open
      });

      // Trigger your dialog
      await widget.onConfirmDelete(
          widget.applicationId, widget.contentChild);

      // If they clicked "Cancel", smoothly snap the card back closed
      if (mounted) {
        setState(() {
          _dragExtent = 0;
        });
      }
    } else {
      // If they didn't drag far enough, snap it closed
      setState(() {
        _dragExtent = 0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // LAYER 1: The Red Background (Always sitting behind)
        Positioned.fill(
          child: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 20),
            decoration: BoxDecoration(
              color: Colors.red,
              borderRadius: BorderRadius.circular(12),
            ),
            child: SvgPicture.asset(
              'assets/icon/trash.svg',
              color: Colors.white,
              width: 24,
              height: 24,
            ),
          ),
        ),

        // LAYER 2: The Swipeable Card
        GestureDetector(
          onHorizontalDragUpdate: _onDragUpdate,
          onHorizontalDragEnd: _onDragEnd,
          child: AnimatedContainer(
            duration:
                const Duration(milliseconds: 100), // Smooth snap animation
            curve: Curves.easeOut,
            // Physically moves the card left by the exact drag amount
            transform: Matrix4.translationValues(_dragExtent, 0, 0),
            child: widget.child,
          ),
        ),
      ],
    );
  }
}
