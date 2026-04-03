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
  State<LeaveApplicationListScreen> createState() => _LeaveApplicationListScreenState();
}

class _LeaveApplicationListScreenState extends State<LeaveApplicationListScreen> {

  var myApplications = [];
  bool isLoading = true;


  @override
  void initState(){
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory ()async{
    final accessToken = await getAccessToken();
    if (accessToken == 'error') {
      setState(() {
        isLoading = false;
      });
      return;}
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
          "Applications List",
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
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
          : myApplications.isEmpty
          ? Center(
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
              "No previous applications or requests",
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
      ) : Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: myApplications.length,
              itemBuilder: (context, index) {
                final application = myApplications[index];
            
                final startDate = DateFormat('dd MMM yyyy')
                    .format(DateTime.parse(application['startDate']));
                final endDate = DateFormat('dd MMM yyyy')
                    .format(DateTime.parse(application['endDate']));
            
                final status = application['status'] ?? '';
            
                final fb = application['feedback']??'N/A';
            
                Color statusColor;
                if (status.toLowerCase() == 'approved') {
                  statusColor = Colors.green;
                } else if (status.toLowerCase() == 'rejected') {
                  statusColor = Colors.red;
                } else {
                  statusColor = Colors.grey;
                }
            
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  color: Colors.white,
                  elevation: 5,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ListTile(
                    contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            
                    title: Text(
                      application['leaveType'] ?? 'Unknown',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        "$startDate  →  $endDate"+((status.toLowerCase() == 'rejected')?"\nFeedback: $fb":""),
                        style: TextStyle(
                          color: Colors.grey[700],
                        ),
                      ),
                    ),
            
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        status.toUpperCase(),
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
              onPressed:(){ 
                Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const LeaveApplicationScreen(),
                ),
              );
              },
              backgroundColor: const Color(0xFF4C4EDB),
              foregroundColor: Colors.white,
              tooltip: "Create application",
              child: const Icon(Icons.add),
          ),
          floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}
