import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_launcher_icons/constants.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/leave_application_list_screen.dart';
import 'package:intl/intl.dart';
import 'package:frontend2/screens/home_screen.dart';

class LeaveApplicationScreen extends StatefulWidget {
  const LeaveApplicationScreen({super.key});
  @override
  State<LeaveApplicationScreen> createState() => _LeaveApplicationScreenState();
}

class _LeaveApplicationScreenState extends State<LeaveApplicationScreen> {

  int? _selectedValue;
  DateTimeRange? _selectedDateRange;
  PlatformFile? _pickedFile;
  final TextEditingController _accountNumberController = TextEditingController();
  final TextEditingController _ifscController = TextEditingController();
  final TextEditingController _bankNameController = TextEditingController();
  final TextEditingController _accountHolderController = TextEditingController();


  Future<void> _selectDateRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: (_selectedValue==3)?(DateTime.now().add(Duration(days: 1))):(DateTime.now()),
      lastDate: DateTime(2027),
      builder: (context, child) {
        return Theme(data: ThemeData.light(), child: child!);
      },
    );
    if (picked != null) {
      setState(() => _selectedDateRange = picked);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'png'],
    );
    if (result != null) {
      setState(() => _pickedFile = result.files.first);
    }
  }

  Future<bool> _sendRequest({required int reason, 
  required DateTimeRange range, 
  PlatformFile? file,
  }) async {

    final accessToken = await getAccessToken();

    final dio = DioClient().dio;

    try {
      FormData formData = FormData.fromMap({
        "leaveType": reason == 1 ? 'Academic' : 'Medical',
        "startDate": DateFormat("yyyy-MM-dd").format(range.start),
        "endDate": DateFormat("yyyy-MM-dd").format(range.end),
        "bankAccountNumber": _accountNumberController.text,
        "bankIFSCCode": _ifscController.text,
        "bankName": _bankNameController.text,
        "bankAccountHoldersName": _accountHolderController.text,
      });
      if (file != null && file.path != null) {
      formData.files.add(
        MapEntry(
          "proofDocument",
          await MultipartFile.fromFile(
            file.path!,
            filename: file.name,
          ),
        ),
      );
    }

      final response = await dio.post(
        MessRebateEndpoints.sendApplication,
        data: formData,
        options: Options(
          headers: {
            'Authorization': 'Bearer $accessToken',
            "Content-Type": "multipart/form-data"
          },
        ),
      );
      return response.statusCode == 200 || response.statusCode == 201;

    } catch (e) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor:Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text(
          "Mess Rebate",
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if(_selectedValue==null){
              Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const LeaveApplicationListScreen(),
              ),
             );
            }else{
              setState(() {
                _selectedValue=null;
              });
            }
          },
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            (_selectedValue == null)?
            _buildSection(
              title: "Type of Leave",
              child: Column(
                children: [
                  RadioListTile<int>(
                    contentPadding: EdgeInsets.zero,
                    title: const Text("Academic Leave"),
                    value: 1,
                    groupValue: _selectedValue,
                    onChanged: (val) => setState(() => _selectedValue = val),
                  ),
                  RadioListTile<int>(
                    contentPadding: EdgeInsets.zero,
                    title: const Text("Medical Leave"),
                    value: 2,
                    groupValue: _selectedValue,
                    onChanged: (val) => setState(() => _selectedValue = val),
                  ),
                  RadioListTile<int>(
                    contentPadding: EdgeInsets.zero,
                    title: const Text("Casual Leave"),
                    value: 3,
                    groupValue: _selectedValue,
                    onChanged: (val) => setState(() => _selectedValue = val),
                  ),
                ],
              ),
            ):Text(
              (_selectedValue==1)?"Academic Leave":((_selectedValue==2)?"Medical Leave":"Casual Leave"),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 24),

            (_selectedValue != null)?
              Column(
              children: [
                _buildSection(
                  title: "Leave Duration",
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.calendar_month),
                    title: Text(_selectedDateRange == null
                        ? "Select Date Range"
                        : "${DateFormat('dd MMM').format(_selectedDateRange!.start)} - ${DateFormat('dd MMM').format(_selectedDateRange!.end)}",
                        style: const TextStyle(fontSize: 15),
                        ),
                    trailing: const Icon(Icons.edit, size: 20),
                    onTap: _selectDateRange,
                  ),
                ),
                const SizedBox(height: 24),


                _buildSection(
                  title: "Supporting Documents",
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.upload_file),
                    title: Text(_pickedFile == null ?((_selectedValue==2)?"Upload File (PDF/IMG) (Max. Size - 5MB) *Optional for now":"Upload File (PDF/IMG) (Max. Size - 5MB)") : _pickedFile!.name,
                    style: const TextStyle(fontSize: 15),
                    ),
                    subtitle: _pickedFile != null ? Text("${(_pickedFile!.size / 1024).toStringAsFixed(2)} KB",style: TextStyle(fontSize: 12),) : null,
                    trailing: const Icon(Icons.attach_file),
                    onTap: _pickFile,
                  ),
                ),
                const SizedBox(height: 24),

                _buildSection(
                  title: "Bank Details",
                  child: Column(
                    children: [

                      const SizedBox(height: 8),

                      TextField(
                        controller: _accountNumberController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: "Bank Account Number",
                          border: OutlineInputBorder(),
                        ),
                      ),

                      const SizedBox(height: 16),

                      TextField(
                        controller: _ifscController,
                        decoration: const InputDecoration(
                          labelText: "IFSC Code",
                          border: OutlineInputBorder(),
                        ),
                      ),

                      const SizedBox(height: 16),

                      TextField(
                        controller: _bankNameController,
                        decoration: const InputDecoration(
                          labelText: "Bank Name",
                          border: OutlineInputBorder(),
                        ),
                      ),

                      const SizedBox(height: 16),

                      TextField(
                        controller: _accountHolderController,
                        decoration: const InputDecoration(
                          labelText: "Account Holder Name",
                          border: OutlineInputBorder(),
                        ),
                      ),

                    ],
                  ),
                ),

                const SizedBox(height: 40),


                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 18,vertical: 18),
                    backgroundColor: Colors.blueAccent,
                    elevation:2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async{

                    if (_selectedValue != null &&
                    _selectedDateRange != null &&
                    _accountNumberController.text.trim().isNotEmpty &&
                    _ifscController.text.trim().isNotEmpty &&
                    _bankNameController.text.trim().isNotEmpty &&
                    _accountHolderController.text.trim().isNotEmpty) {

                  if ((_selectedValue == 'Casual' || _selectedValue == 'Academic') &&
                      _pickedFile == null) {
                    _showStatusDialog(
                      isSuccess: false,
                      title: "Failure",
                      message: "Please upload a document for $_selectedValue leave.",
                    );
                    return;
                  }

                  if (_pickedFile != null &&
                      (_pickedFile!.size) / (1024 * 1024) >= 5) {
                    _showStatusDialog(
                      isSuccess: false,
                      title: "Failure",
                      message: "File size exceeds 5 MB.",
                    );
                    return;
                  }

                  if ((_selectedDateRange!.end
                              .difference(_selectedDateRange!.start)
                              .inDays +1) <4) {
                    _showStatusDialog(
                      isSuccess: false,
                      title: "Failure",
                      message: "Leave must atleast be of 4 days.",
                    );
                    return;
                  }

                  bool flag = await _sendRequest(
                    reason: _selectedValue!,
                    range: _selectedDateRange!,
                    file: _pickedFile, 
                  );

                  if (flag) {
                    _showStatusDialog(
                      isSuccess: true,
                      title: "Success",
                      message: "Application sent successfully!",
                    );
                  } else {
                    _showStatusDialog(
                      isSuccess: false,
                      title: "Failure",
                      message:
                          "Something went wrong. Please check your connection and try again.",
                    );
                  }

                } else {
                  _showStatusDialog(
                    isSuccess: false,
                    title: "Failure",
                    message: "Please fill all fields.",
                  );
                }
                  },
                  child: const Text("Submit Application", style: TextStyle(color: Colors.white, fontSize: 16)),
                ),
              ],
            ):const Text(
              "Select a type of leave to continue.",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.black54,
              ),
            ),

          const SizedBox(height: 40),
          ],
        ),
            
      ),
    );
  }


  Widget _buildSection({required String title, required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10,spreadRadius: 1,offset: Offset(0, 4),)
        ],),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const Divider(),
          child,
        ],
      ),
    );
  }

  void _showStatusDialog({
    required bool isSuccess,
    required String title,
    required String message,
  }) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Icon Container
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isSuccess ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isSuccess ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                    color: isSuccess ? Colors.green : Colors.red,
                    size: 60,
                  ),
                ),
                const SizedBox(height: 24),

                // Title
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 12),

                // Message
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 32),

                // Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isSuccess ? Colors.green : Colors.red,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    onPressed: () {
                      Navigator.pop(context); // close dialog
                      if (isSuccess) {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (context) =>
                                const LeaveApplicationListScreen(),
                          ),
                        );
                      }
                    },
                    child: Text(
                      isSuccess ? "Awesome!" : "Try Again",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}