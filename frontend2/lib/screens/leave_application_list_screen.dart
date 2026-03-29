import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_launcher_icons/constants.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/leave_application_screen.dart';
import 'package:intl/intl.dart';
import 'package:frontend2/screens/home_screen.dart';

class LeaveApplicationListScreen extends StatefulWidget {
  const LeaveApplicationListScreen({super.key});

  @override
  State<LeaveApplicationListScreen> createState() =>
      _LeaveApplicationListScreenState();
}

class _LeaveTypeCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final VoidCallback onTap;

  const _LeaveTypeCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFF4C4EDB).withOpacity(0.1),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(
                icon,
                color: const Color(0xFF4C4EDB),
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF2E2F31),
                    ),
                  ),
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
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFF4C4EDB)),
          ],
        ),
      ),
    );
  }
}

class _LeaveApplicationListScreenState
    extends State<LeaveApplicationListScreen> {
  var myApplications = [];
  bool isLoading = true;
  String selectedTab = 'All';
  final List<String> filterTabs = ['All', 'Approved', 'Decline', 'Deleted'];

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
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text(
          "Mess Rebate",
          style: TextStyle(
              color: Colors.black, fontWeight: FontWeight.w500, fontSize: 20),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const HomeScreen(),
              ),
            );
          },
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // "Want to take a leave?" Section
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 32, 16, 20),
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
                        _LeaveTypeCard(
                          title: "Casual",
                          description:
                              "Short, unforeseen personal work or urgent errands.",
                          icon: Icons.note_outlined,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(leaveType: 1,),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        _LeaveTypeCard(
                          title: "Academic",
                          description:
                              "Research, field trips, or attending conferences/competitions.",
                          icon: Icons.card_membership_outlined,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(leaveType: 2,),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        _LeaveTypeCard(
                          title: "Medical",
                          description: "Recovery from illness or injury.",
                          icon: Icons.health_and_safety_outlined,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(leaveType: 3,),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        // Info box
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 0),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.info_outline,
                                size: 16,
                                color: Color(0xFF2E2F31),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  "Mess rebate requires applying at least 4 days in advance.",
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF535353),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Divider
                  Container(
                    height: 8,
                    color: const Color(0xFFF0F0F0),
                  ),
                  // "View past leaves" Section
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "View past leaves",
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
                              int count =
                                  tab == 'All' ? myApplications.length : 0;
                              String tabLabel = tab == 'All'
                                  ? 'All (${myApplications.length})'
                                  : tab;
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
                        if (myApplications.isEmpty)
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
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
                              ],
                            ),
                          )
                        else
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: myApplications.length,
                            itemBuilder: (context, index) {
                              final application = myApplications[index];
                              final startDate = DateFormat('dd MMM').format(
                                  DateTime.parse(application['startDate'])
                                      .add(const Duration(days: 1)));
                              final endDate = DateFormat('dd MMM').format(
                                  DateTime.parse(application['endDate'])
                                      .add(const Duration(days: 1)));
                              final status = application['status'] ?? '';
                              final leaveType =
                                  application['leaveType'] ?? 'Leave';

                              Color statusColor = const Color(0xFFA36500);
                              IconData statusIcon = Icons.done_all;

                              if (status.toLowerCase() == 'approved') {
                                statusColor = Colors.green;
                                statusIcon = Icons.check_circle;
                              } else if (status.toLowerCase() == 'rejected') {
                                statusColor = Colors.red;
                                statusIcon = Icons.cancel;
                              }

                              IconData leaveIcon = Icons.note_outlined;
                              if (leaveType
                                  .toLowerCase()
                                  .contains('academic')) {
                                leaveIcon = Icons.card_membership_outlined;
                              } else if (leaveType
                                  .toLowerCase()
                                  .contains('medical')) {
                                leaveIcon = Icons.health_and_safety_outlined;
                              }

                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF5F5F5),
                                    border: Border.all(
                                        color: const Color(0xFFE6E6E6)),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  padding: const EdgeInsets.all(16),
                                  child: Row(
                                    children: [
                                      Icon(leaveIcon,
                                          size: 20,
                                          color: const Color(0xFF535353)),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              leaveType,
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w400,
                                                color: Color(0xFF2E2F31),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                            "$startDate - $endDate",
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w400,
                                              color: Color(0xFF2E2F31),
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            status == 'pending'
                                                ? "Waiting for approval"
                                                : status.toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w500,
                                              fontStyle: FontStyle.italic,
                                              color: statusColor,
                                              letterSpacing: 0.2,
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (status.toLowerCase() == 'approved' ||
                                          status.toLowerCase() == 'rejected')
                                        Padding(
                                          padding:
                                              const EdgeInsets.only(left: 8),
                                          child: Container(
                                            width: 16,
                                            height: 16,
                                            decoration: BoxDecoration(
                                              color: statusColor,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
      
    );
  }
}
