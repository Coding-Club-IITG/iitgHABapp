import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_launcher_icons/constants.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/leave_application_screen.dart';
import 'package:intl/intl.dart';
import 'package:frontend2/screens/home_screen.dart';
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
          Container(
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

class _LeaveApplicationListScreenState
    extends State<LeaveApplicationListScreen> {
  var myApplications = [];
  bool isUploading = false;
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
          const SnackBar(content: Text('Error deleting application')),
        );
        return false;
      }
      final dio = DioClient().dio;
      final response = await dio.delete(
        '${MessRebateEndpoints.getApplications}/$applicationId',
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        setState(() {
          myApplications.removeWhere((app) => app['_id'] == applicationId);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Application deleted successfully')),
        );
        await _fetchHistory();
        return true;
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete application')),
        );
        return false;
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error deleting application')),
      );
      return false;
    }
  }

  Future<void> _uploadLateDocument(String applicationId) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'png'],
    );
    if (result == null) return;
    final pickedFile = result.files.first;
    if (pickedFile.path == null) return;

    final accessToken = await getAccessToken();
    if (accessToken == 'error') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Authentication error')),
      );
      return;
    }
    final dio = DioClient().dio;
    try {
      FormData formData = FormData.fromMap({
        "proofDocument": await MultipartFile.fromFile(
          pickedFile.path!,
          filename: pickedFile.name,
        ),
      });
      final response = await dio.post(
        '${MessRebateEndpoints.getApplications}/$applicationId/upload-late-medical-document',
        data: formData,
        options: Options(
          headers: {
            'Authorization': 'Bearer $accessToken',
            "Content-Type": "multipart/form-data"
          },
        ),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document uploaded successfully')),
        );
        await _fetchHistory();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to upload document')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error uploading document')),
      );
    }
  }

  Widget _buildUploadProofButton(VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE6E6E6)),
          borderRadius: BorderRadius.circular(8),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.upload_file, color: const Color(0xFF4C4EDB), size: 16),
            const SizedBox(width: 8),
            Text(
              "Upload Proof",
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xFF4C4EDB),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<dynamic> _getFilteredApplications() {
    if (selectedTab == 'All') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() != 'cancelled')
          .toList();
    } else if (selectedTab == 'Approved') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'approved')
          .toList();
    } else if (selectedTab == 'Decline') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'rejected')
          .toList();
    } else if (selectedTab == 'Deleted') {
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
    } else if (tab == 'Approved') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'approved')
          .length;
    } else if (tab == 'Decline') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'rejected')
          .length;
    } else if (tab == 'Deleted') {
      return myApplications
          .where((app) => app['status']?.toLowerCase() == 'cancelled')
          .length;
    }
    return 0;
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
                          "Casual",
                          "Short, unforeseen personal work or urgent errands.",
                          'assets/icon/notes.svg',
                          () async {
                            final result = await
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(
                                  leaveType: 1,
                                ),
                              ),
                            );

                            if(result == true) {
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
                            final result = await
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(
                                  leaveType: 2,
                                ),
                              ),
                            );

                            if(result == true) {
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
                            final result = await 
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const LeaveApplicationScreen(
                                  leaveType: 3,
                                ),
                              ),
                            );

                            if(result == true) {
                              _fetchHistory();
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        // Info box
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 0),
                          child: Row(
                            children: [
                              SvgPicture.asset(
                                'assets/icon/info-circle.svg',
                                width: 16,
                                height: 16,
                                color: const Color(0xFF2E2F31),
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
                            if (filteredApplications.isEmpty)
                              return Center(
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
                              );
                            return ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: filteredApplications.length,
                              itemBuilder: (context, index) {
                                final filteredApplications =
                                    _getFilteredApplications();
                                final application = filteredApplications[index];
                                final applicationId = application['_id'] ?? '';
                                final startDate = DateFormat('dd MMM').format(
                                    DateTime.parse(application['startDate'])
                                        .add(const Duration(days: 1)));
                                final endDate = DateFormat('dd MMM').format(
                                    DateTime.parse(application['endDate'])
                                        .add(const Duration(days: 1)));
                                final status = application['status'] ?? '';
                                final leaveType =
                                    application['leaveType'] ?? 'Leave';
                                final proofDocument = application['proofDocumentFilename'] != null || application['proofDocumentUrl'] != null;

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

                                var messageText = "";

                                var canUpload = false;

                                if (status.toLowerCase() == 'pending') {
                                  // final startDateParsed =
                                  //     DateTime.parse(application['startDate']);
                                  final appliedDateParsed =
                                      DateTime.parse(application['appliedAt']);
                                  final now = DateTime.now();
                                  final daysDiff =
                                      appliedDateParsed.add(const Duration(days: 7)).difference(now).inDays;
                                  final isMedical = leaveType
                                      .toLowerCase()
                                      .contains('medical');
                                  canUpload = daysDiff >= 0 && isMedical && !proofDocument;
                                  final daysLeftText = daysDiff >= 0
                                      ? '${daysDiff + 1} day${daysDiff + 1 == 1 ? '' : 's'} left to upload'
                                      : 'Upload window expired';

                                  // Attach upload reminder/info into card content if medical
                                  messageText = isMedical
                                      ? (canUpload
                                          ? daysLeftText
                                          : 'Waiting for approval')
                                      : (status.toLowerCase()=='pending'? 'Waiting for approval' : '');

                                  statusColor = isMedical
                                      ? (canUpload
                                          ? Color(0xFF4B4EDA)
                                          : statusColor)
                                      : statusColor;
                                  
                                }

                                // 1. PURE CARD CONTENT (No outer margins here)
                                final cardContent = FittedBox(
                                  fit: BoxFit.scaleDown, // Only shrinks if it hits the maxWidth, otherwise does nothing
                                  child: Container(
                                    // 1. ADD THIS: It gives Expanded a wall to hit, preventing the crash
                                    constraints: BoxConstraints(
                                      maxWidth: MediaQuery.of(context).size.width - 32, // Adjust 32 based on your screen's side padding
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF5F5F5),
                                      border: Border.all(color: const Color(0xFFE6E6E6)),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    padding: const EdgeInsets.all(16),
                                    
                                    // 2. The rest of your exact widget stays completely untouched!
                                    child: Row(
                                      children: [
                                        Icon(leaveIcon, size: 20, color: const Color(0xFF535353)),
                                        const SizedBox(width: 16),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                leaveType,
                                                maxLines: 1,
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
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            if (messageText.isNotEmpty) ...[
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
                                                messageText,
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w500,
                                                  fontStyle: FontStyle.italic,
                                                  color: statusColor,
                                                  letterSpacing: 0.2,
                                                ),
                                              ),
                                            ] else ...[
                                              const SizedBox(height: 10),
                                              Text(
                                                "$startDate - $endDate",
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w400,
                                                  color: Color(0xFF2E2F31),
                                                ),
                                              ),
                                              const SizedBox(height: 10),
                                            ]
                                          ],
                                        ),
                                        if (canUpload)
                                          Container(
                                            padding: const EdgeInsets.only(left: 8),
                                            child: const Icon(
                                              Icons.chevron_right,
                                              color: Color(0xFF535353),
                                            ),
                                          ),
                                        if (status.toLowerCase() == 'approved' ||
                                            status.toLowerCase() == 'rejected')
                                          Padding(
                                            padding: const EdgeInsets.fromLTRB(8, 3, 3, 5),
                                            child: Container(
                                              padding: const EdgeInsets.all(4),
                                              width: 10,
                                              height: 10,
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


                                final whiteCardContent = FittedBox(
                                  fit: BoxFit.scaleDown, // Only shrinks if it hits the maxWidth, otherwise does nothing
                                  child: Container(
                                    // 1. ADD THIS: It gives Expanded a wall to hit, preventing the crash
                                    constraints: BoxConstraints(
                                      maxWidth: MediaQuery.of(context).size.width - 32, // Adjust 32 based on your screen's side padding
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFFFFF),
                                      border: Border.all(color: const Color(0xFFE6E6E6)),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    padding: const EdgeInsets.all(16),
                                    
                                    // 2. The rest of your exact widget stays completely untouched!
                                    child: Row(
                                      children: [
                                        Icon(leaveIcon, size: 20, color: const Color(0xFF535353)),
                                        const SizedBox(width: 16),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                leaveType,
                                                maxLines: 1,
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
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            if (messageText.isNotEmpty) ...[
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
                                                messageText,
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w500,
                                                  fontStyle: FontStyle.italic,
                                                  color: statusColor,
                                                  letterSpacing: 0.2,
                                                ),
                                              ),
                                            ] else ...[
                                              const SizedBox(height: 10),
                                              Text(
                                                "$startDate - $endDate",
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w400,
                                                  color: Color(0xFF2E2F31),
                                                ),
                                              ),
                                              const SizedBox(height: 10),
                                            ]
                                          ],
                                        ),
                                        if (canUpload)
                                          Container(
                                            padding: const EdgeInsets.only(left: 8),
                                            child: const Icon(
                                              Icons.chevron_right,
                                              color: Color(0xFF535353),
                                            ),
                                          ),
                                        if (status.toLowerCase() == 'approved' ||
                                            status.toLowerCase() == 'rejected')
                                          Padding(
                                            padding: const EdgeInsets.fromLTRB(8, 3, 3, 5),
                                            child: Container(
                                              padding: const EdgeInsets.all(4),
                                              width: 10,
                                              height: 10,
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

                                // 2. LOGIC FOR PENDING (Swipeable via Stack)
                                if (status.toLowerCase() == 'pending') {
                                  Widget interactiveChild = cardContent;
                                  if (canUpload) {
                                    interactiveChild = GestureDetector(
                                      onTap: () {
                                        _showUploadDialog(applicationId, 
                                          StatefulBuilder(
                                            builder: (context, setDialogueState) {
                                              return FittedBox(
                                              fit: BoxFit.scaleDown, // Only shrinks if it hits the maxWidth, otherwise does nothing
                                              child: Container(
                                                // 1. ADD THIS: It gives Expanded a wall to hit, preventing the crash
                                                constraints: BoxConstraints(
                                                  maxWidth: MediaQuery.of(context).size.width - 32, // Adjust 32 based on your screen's side padding
                                                ),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFFFFFFF),
                                                  border: Border.all(color: const Color(0xFFE6E6E6)),
                                                  borderRadius: BorderRadius.circular(12),
                                                ),
                                                padding: const EdgeInsets.all(16),
                                                
                                                // 2. The rest of your exact widget stays completely untouched!
                                                child: Column(
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Icon(leaveIcon, size: 20, color: const Color(0xFF535353)),
                                                        const SizedBox(width: 16),
                                                        Expanded(
                                                          child: Column(
                                                            crossAxisAlignment: CrossAxisAlignment.start,
                                                            children: [
                                                              Text(
                                                                leaveType,
                                                                maxLines: 1,
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
                                                          crossAxisAlignment: CrossAxisAlignment.end,
                                                          children: [
                                                            if (messageText.isNotEmpty) ...[
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
                                                                messageText,
                                                                style: TextStyle(
                                                                  fontSize: 14,
                                                                  fontWeight: FontWeight.w500,
                                                                  fontStyle: FontStyle.italic,
                                                                  color: statusColor,
                                                                  letterSpacing: 0.2,
                                                                ),
                                                              ),
                                                            ] else ...[
                                                              const SizedBox(height: 10),
                                                              Text(
                                                                "$startDate - $endDate",
                                                                style: const TextStyle(
                                                                  fontSize: 12,
                                                                  fontWeight: FontWeight.w400,
                                                                  color: Color(0xFF2E2F31),
                                                                ),
                                                              ),
                                                              const SizedBox(height: 10),
                                                            ]
                                                          ],
                                                        ),
                                                        if (canUpload)
                                                          Container(
                                                            padding: const EdgeInsets.only(left: 8),
                                                            child: const Icon(
                                                              Icons.chevron_right,
                                                              color: Color(0xFF535353),
                                                            ),
                                                          ),
                                                        if (status.toLowerCase() == 'approved' ||
                                                            status.toLowerCase() == 'rejected')
                                                          Padding(
                                                            padding: const EdgeInsets.fromLTRB(8, 3, 3, 5),
                                                            child: Container(
                                                              padding: const EdgeInsets.all(4),
                                                              width: 10,
                                                              height: 10,
                                                              decoration: BoxDecoration(
                                                                color: statusColor,
                                                                shape: BoxShape.circle,
                                                              ),
                                                            ),
                                                          ),
                                                      ],
                                                    ),
                                                    SizedBox(height: 12),
                                                    GestureDetector(
                                                      onTap: isUploading ? null : () async {
                                                        setDialogueState(() {
                                                          isUploading = true;
                                                        });
                                                        try {
                                                          await _uploadLateDocument(applicationId);
                                                        } finally {
                                                          isUploading = false;
                                                          if (context.mounted) {
                                                            Navigator.pop(context);
                                                          }
                                                        }
                                                      },
                                                      child: Container(
                                                        decoration: BoxDecoration(
                                                          border: Border.all(color: Color(0xFFE6E6E6)),
                                                          borderRadius: BorderRadius.circular(12),
                                                          color: Colors.white,
                                                        ),
                                                        padding:
                                                            const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                                                        child: Row(
                                                                mainAxisAlignment: MainAxisAlignment.center,
                                                                children: isUploading 
                                                                  ? [
                                                                      // SHOW LOADING ANIMATION
                                                                      const SizedBox(
                                                                        height: 20,
                                                                        width: 20,
                                                                        child: CircularProgressIndicator(
                                                                          strokeWidth: 2,
                                                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.black),
                                                                        ),
                                                                      ),
                                                                      const SizedBox(width: 8),
                                                                      const Text("Uploading...", style: TextStyle(fontSize: 14, color: Colors.black)),
                                                                    ]
                                                                  :[
                                                                  SvgPicture.asset(
                                                                    'assets/icon/download-2-line.svg',
                                                                    color: Colors.black,
                                                                    width: 20,
                                                                    height: 20,
                                                                  ),
                                                                  const SizedBox(width: 8),
                                                                  Text(
                                                                    "Upload a PDF",
                                                                    style: TextStyle(
                                                                      fontSize: 14,
                                                                      fontWeight: FontWeight.w500,
                                                                      color: Colors.black,
                                                                    ),
                                                                  ),
                                                                ],
                                                              )
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              );
                                            },
                                          )
                                        );
                                      },
                                      child: cardContent,
                                    );
                                  }

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 10),
                                    // Use the custom native widget here!
                                    child: NativeSwipeToReveal(
                                      applicationId: applicationId,
                                      child: interactiveChild,
                                      contentChild: whiteCardContent,
                                      // Pass a reference to your dialog function
                                      onConfirmDelete: (id, card) {
                                        return _showConfirmDeleteDialog(id, card);
                                      },
                                    ),
                                  );
                                }

                                // 3. LOGIC FOR ALL OTHER STATUSES
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: cardContent,
                                );
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

  Future<bool> _showConfirmDeleteDialog(String applicationId, Widget cardContent) async {
    final bool? shouldDelete = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          insetPadding: EdgeInsets.symmetric(horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          backgroundColor: Colors.white,
          child: Padding(
            padding: const EdgeInsets.only(top: 12, left: 16, right: 16, bottom: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  alignment: Alignment.centerLeft,
                  child: const Text(
                    'Do you want to delete?',
                    style: TextStyle(
                      color: Color(0xFF676767), // Grey-1
                      fontSize: 16,
                      fontFamily: 'General Sans Variable',
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
                            color: const Color(0xFF4B4EDA) /* Brand-Primary */,
                            fontSize: 16,
                            fontFamily: 'General Sans Variable',
                            fontWeight: FontWeight.w500,
                            height: 1.50,
                          ),
                        )
                      ),
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

  Future<bool> _showUploadDialog(String applicationId, Widget cardContent) async {
    final bool? shouldDelete = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          insetPadding: EdgeInsets.symmetric(horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          backgroundColor: Colors.white,
          child: Padding(
            padding: const EdgeInsets.only(top: 12, left: 16, right: 16, bottom: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  alignment: Alignment.centerLeft,
                  child: const Text(
                    'Do you want to upload a proof?',
                    style: TextStyle(
                      color: Color(0xFF676767), // Grey-1
                      fontSize: 16,
                      fontFamily: 'General Sans Variable',
                      fontWeight: FontWeight.w600,
                      height: 1.50,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                // Your injected custom card content
                cardContent,
              ],
            ),
          ),
        );
      }
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
    Key? key,
    required this.child,
    required this.contentChild,
    required this.applicationId,
    required this.onConfirmDelete,
  }) : super(key: key);

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
      if (_dragExtent < -_maxDrag) _dragExtent = -_maxDrag; // Stops exactly at 60px
    });
  }

  void _onDragEnd(DragEndDetails details) async {
    // If they dragged more than halfway, snap it open and show the dialog
    if (_dragExtent < -(_maxDrag / 2)) {
      setState(() {
        _dragExtent = -_maxDrag; // Snap fully open
      });

      // Trigger your dialog
      bool shouldDelete = await widget.onConfirmDelete(widget.applicationId, widget.contentChild);
      
      // If they clicked "Cancel", smoothly snap the card back closed
      if (!shouldDelete && mounted) {
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
            duration: const Duration(milliseconds: 100), // Smooth snap animation
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
