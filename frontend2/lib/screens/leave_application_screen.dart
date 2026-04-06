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
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';

Future<void> _launchUrl(String url) async {
  final Uri uri = Uri.parse(url);
  if (!await launchUrl(uri)) {
    throw Exception('Could not launch $url');
  }
}

class LeaveApplicationScreen extends StatefulWidget {
  const LeaveApplicationScreen({super.key, required this.leaveType});
  final int? leaveType;
  
  @override
  State<LeaveApplicationScreen> createState() => _LeaveApplicationScreenState();
}

class _LeaveApplicationScreenState extends State<LeaveApplicationScreen> {
  // Constants
  static const Color _primaryColor = Color(0xFF4C4EDB);
  static const Color _successColor = Color(0xFF1F8441);
  static const Color _successBgColor = Color(0xFFE2F2EB);
  static const Color _borderColor = Color(0xFFE6E6E6);
  static const Color _greyBg = Color(0xFFF5F5F5);
  static const Color _greyText = Color(0xFF939393);
  final FocusNode _reasonFocusNode = FocusNode();

  // State variables
  int? _selectedValue; // 1: Casual, 2: Academic, 3:Medical
  int _currentStep = 1; // 1 or 2
  DateTimeRange? _selectedDateRange;
  PlatformFile? _pickedFile;
  PlatformFile? _pickedFileLeaveForm;
  bool _agreeToTerms = false;
  bool _isBankSaved = false;
  bool _isSubmitting = false;
  DateTime? _lastSubmitTime;
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _accountNumberController =
      TextEditingController();
  final TextEditingController _ifscController = TextEditingController();
  final TextEditingController _bankNameController = TextEditingController();
  final TextEditingController _accountHolderController =
      TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedValue = widget.leaveType;
    _currentStep = 1;
    _loadBankDetails();
  }

  @override
  void dispose() {
    _reasonFocusNode.dispose();
    super.dispose();
  }

  Future<void> _selectDateRange() async {
    DateTime today = DateTime.now();
    DateTime baseDate = DateTime(today.year, today.month, today.day);
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: (_selectedValue == 3)
          ? baseDate.add(const Duration(days: 1))
          : baseDate.add(const Duration(days: 4)),
      lastDate: DateTime(2027),
      builder: (context, child) {
        return Theme(data: ThemeData.light(), child: child!);
      },
    );
    if (picked != null) {
      setState(() => _selectedDateRange = picked);
    }
  }

  Future<void> _loadBankDetails() async {
    final prefs = await SharedPreferences.getInstance();

    final accountHolder = prefs.getString('accountHolder');
    final bankName = prefs.getString('bankName');
    final accountNumber = prefs.getString('accountNumber');
    final ifsc = prefs.getString('ifsc');

    setState(() {
      _accountHolderController.text = accountHolder ?? '';
      _bankNameController.text = bankName ?? '';
      _accountNumberController.text = accountNumber ?? '';
      _ifscController.text = ifsc ?? '';

      _isBankSaved = accountHolder != null &&
          bankName != null &&
          accountNumber != null &&
          ifsc != null &&
          accountHolder.isNotEmpty &&
          bankName.isNotEmpty &&
          accountNumber.isNotEmpty &&
          ifsc.isNotEmpty;
    });
  }

  void _onFieldChanged() {
    if (_isBankSaved) {
      setState(() => _isBankSaved = false);
    }
  }

  Future<void> _saveBankDetails() async {
    if (_accountHolderController.text.isEmpty ||
        _bankNameController.text.isEmpty ||
        _accountNumberController.text.isEmpty ||
        _ifscController.text.isEmpty) {
      _showSnackBar("Fill all fields before saving");
      return;
    }

    final prefs = await SharedPreferences.getInstance();

    await prefs.setString('accountHolder', _accountHolderController.text);
    await prefs.setString('bankName', _bankNameController.text);
    await prefs.setString('accountNumber', _accountNumberController.text);
    await prefs.setString('ifsc', _ifscController.text);

    setState(() {
      _isBankSaved = true;
    });

    _showSnackBar("Bank details saved successfully");
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

  Future<void> _pickFileLeaveForm() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'png'],
    );
    if (result != null) {
      setState(() => _pickedFileLeaveForm = result.files.first);
    }
  }

  Future<bool> _sendRequest() async {
    final accessToken = await getAccessToken();
    final dio = DioClient().dio;

    try {
      FormData formData = FormData.fromMap({
        "leaveType": (_selectedValue == 1)
            ? 'Casual'
            : (_selectedValue == 2)
                ? 'Academic'
                : 'Medical',
        "startDate": DateFormat("yyyy-MM-dd").format(_selectedDateRange!.start),
        "endDate": DateFormat("yyyy-MM-dd").format(_selectedDateRange!.end),
        "bankAccountNumber": _accountNumberController.text,
        "bankIFSCCode": _ifscController.text,
        "bankName": _bankNameController.text,
        "bankAccountHoldersName": _accountHolderController.text,
      });
      if (_pickedFile != null && _pickedFile!.path != null) {
        formData.files.add(
          MapEntry(
            "proofDocument",
            await MultipartFile.fromFile(
              _pickedFile!.path!,
              filename: _pickedFile!.name,
            ),
          ),
        );
      }

      if (_pickedFileLeaveForm != null && _pickedFileLeaveForm!.path != null) {
        formData.files.add(
          MapEntry(
            "leaveDocument",
            await MultipartFile.fromFile(
              _pickedFileLeaveForm!.path!,
              filename: _pickedFileLeaveForm!.name,
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

  int _calculateLeaveDays() {
    if (_selectedDateRange == null) return 0;
    return _selectedDateRange!.end
            .difference(_selectedDateRange!.start)
            .inDays +
        1;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      // resizeToAvoidBottomInset: false,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.black),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Mess Rebate",
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w500,
                fontSize: 20,
              ),
            ),
            Text(
              getLeaveTypeText(),
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_currentStep == 2) {
              setState(() => _currentStep = 1);
            } else {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const LeaveApplicationListScreen(),
                ),
              );
            }
          },
        ),
      ),
      body: _currentStep == 1 ? _buildStep1() : _currentStep == 2 ? _buildStep2() : _buildStep3(),
    );
  }

  String getLeaveTypeText() {
    switch (_selectedValue) {
      case 1:
        return "Casual Leave";
      case 2:
        return "Academic Leave";
      case 3:
        return "Medical Leave";
      default:
        return "";
    }
  }

  Widget _buildStep1() {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildProgressHeader(1),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Reason for Leave
                    // const SizedBox(height: 24),
                    const Text(
                      "Reason for Leave",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    StatefulBuilder(
                      builder: (context, setState) {
                        bool isFocused = _reasonFocusNode.hasFocus;
                        bool isFilled = _reasonController.text.isNotEmpty;
              
                        Color borderColor = _borderColor;
                        Color fillColor = _greyBg;
                        Widget? suffixIcon;
              
                        if (isFocused) {
                          // Focused
                          borderColor = _primaryColor;
                          fillColor = _primaryColor.withOpacity(0.08);
                        } else if (isFilled) {
                          //Completed
                          suffixIcon = const Icon(Icons.check, color: Colors.green);
                        }
              
                        return TextField(
                          controller: _reasonController,
                          focusNode: _reasonFocusNode,
                          onChanged: (_) => setState(() {}),
                          onSubmitted: (_) {
                            FocusScope.of(context).unfocus();
                            setState(() {});
                          },
                          decoration: InputDecoration(
                            hintText: "e.g. Trip to home",
                            hintStyle: const TextStyle(color: _greyText, fontSize: 14),
                            filled: true,
                            fillColor: fillColor,
                            suffixIcon: suffixIcon,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: borderColor, width: 1),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: borderColor, width: 1),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide:
                                  const BorderSide(color: _primaryColor, width: 2),
                            ),
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                        );
                      },
                    ),
              
                    // Duration of Absence
                    const SizedBox(height: 24),
                    const Text(
                      "Select the duration of absence",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      "From",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _selectDateRange,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _borderColor),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white,
                        ),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        child: Row(
                          children: [
                            SvgPicture.asset(
                              'assets/icon/calendar.svg',
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 12),
                            Text(
                              _selectedDateRange == null
                                  ? "DD/MM/YY"
                                  : DateFormat("dd/MM/yy")
                                      .format(_selectedDateRange!.start),
                              style: TextStyle(
                                fontSize: 14,
                                color: _selectedDateRange == null
                                    ? _greyText
                                    : Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      "Till",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _selectDateRange,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _borderColor),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white,
                        ),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        child: Row(
                          children: [
                            SvgPicture.asset(
                              'assets/icon/calendar.svg',
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 12),
                            Text(
                              _selectedDateRange == null
                                  ? "DD/MM/YY"
                                  : DateFormat("dd/MM/yy")
                                      .format(_selectedDateRange!.end),
                              style: TextStyle(
                                fontSize: 14,
                                color: _selectedDateRange == null
                                    ? _greyText
                                    : Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
              
                    // Info text
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Icon(Icons.info, size: 16, color: Color(0xFF676767)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            "You will receive a rebate of ₹XXXX per day on approved mess leave.",
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                        ),
                      ],
                    ),
              
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
        SliverFillRemaining(
          hasScrollBody: false,
          child: Column(
            children: [
              // 2. This transparent Spacer "eats" the extra white space
              const Spacer(),
              _buildBottomButtons(
                onNext: () {
                  if (_reasonController.text.isEmpty) {
                    _showSnackBar("Please enter reason for leave");
                    return;
                  }
                  if (_selectedDateRange == null) {
                    _showSnackBar("Please select dates");
                    return;
                  }
                  if (_selectedDateRange!.end
                              .difference(_selectedDateRange!.start)
                              .inDays +
                          1 <
                      4) {
                    _showSnackBar("Mess Rebate is only Applicable to a duration of atleast 4 days");
                    return;
                  }
                  setState(() => _currentStep = 2);
                },
                showBack: false,
                nextLabel: "Next",
              ),
            ]
          )
        ),
      ],
    );
  }

  Widget _buildStep2() {
    // int leaveDays = _calculateLeaveDays();

    return Stack(
      children:[
        CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildProgressHeader(2),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Info Box
                      // Container(
                      //   decoration: BoxDecoration(
                      //     color: _successBgColor,
                      //     borderRadius: BorderRadius.circular(12),
                      //   ),
                      //   padding:
                      //       const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      //   child: Row(
                      //     mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      //     children: [
                      //       Text(
                      //         "Leave days taken: $leaveDays",
                      //         style: const TextStyle(
                      //           fontSize: 12,
                      //           color: Colors.black,
                      //         ),
                      //       ),
                      //       const Text(
                      //         "500 Rupee",
                      //         style: TextStyle(
                      //           fontSize: 16,
                      //           fontWeight: FontWeight.w500,
                      //           color: _successColor,
                      //         ),
                      //       ),
                      //     ],
                      //   ),
                      // ),
                
                      // const SizedBox(height: 24),
                
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "Upload Leave Form",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Colors.black,
                          ),
                        ),
                        InkWell(
                          onTap: () {
                            _launchUrl("https://swc.iitg.ac.in/sa_portal_backend/uploads/Hostel05_0001_f895c91cc7_1d23d40a4a.pdf");
                          },
                          child: const Text(
                            "Download Leave Form",
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.blueGrey,
                            ),                          
                          ),
                        )
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      "Leave Form is an institutional Document and a Copy of this Document needs to be submitted at the Security Desk of your Hostel before leaving the Campus.",
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF535353),
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _pickFileLeaveForm,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _borderColor),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white,
                        ),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                        child: _pickedFileLeaveForm == null
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SvgPicture.asset(
                                    'assets/icon/download-2-line.svg',
                                    color: _primaryColor,
                                    width: 20,
                                    height: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    "Upload a PDF",
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: _primaryColor,
                                    ),
                                  ),
                                ],
                              )
                            : Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 14),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.grey.shade300),
                                ),
                                child: Row(
                                  children: [
                                    SvgPicture.asset(
                                      'assets/icon/file-upload.svg',
                                      color: _primaryColor,
                                      width: 20,
                                      height: 20,
                                    ),
                                    const SizedBox(width: 10),
                
                                    /// File name
                                    Expanded(
                                      child: Text(
                                        _pickedFileLeaveForm!.name,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                
                                    /// Green check
                                    SvgPicture.asset(
                                      'assets/icon/check.svg',
                                      color: Colors.green,
                                    ),
                                  ],
                                ),
                              ),
                      ),
                    ),
                
                
                    // Upload Valid Proof
                    const SizedBox(height: 24),
                    const Text(
                      "Upload Valid Proof",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      "Proof can be travel ticket or parents consent with signature.\nIn case of a medical leave then you can upload a valid proof 7 days after submitting your application.",
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF535353),
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _pickFile,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _borderColor),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white,
                        ),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                        child: _pickedFile == null
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SvgPicture.asset(
                                    'assets/icon/download-2-line.svg',
                                    color: _primaryColor,
                                    width: 20,
                                    height: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    "Upload a PDF",
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: _primaryColor,
                                    ),
                                  ),
                                ],
                              )
                            : Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 14),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.grey.shade300),
                                ),
                                child: Row(
                                  children: [
                                    SvgPicture.asset(
                                      'assets/icon/file-upload.svg',
                                      color: _primaryColor,
                                      width: 20,
                                      height: 20,
                                    ),
                                    const SizedBox(width: 10),
                
                                    /// File name
                                    Expanded(
                                      child: Text(
                                        _pickedFile!.name,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                
                                    /// Green check
                                    SvgPicture.asset(
                                      'assets/icon/check.svg',
                                      color: Colors.green,
                                    ),
                                  ],
                                ),
                              ),
                      ),
                    ),
                
                    const SizedBox(height: 40),
                
                    ],
                  ),
                ),
              ],
              ),
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: Column(
                children: [
                  const Spacer(),
                  _buildBottomButtons(
                    onNext: () async {
                      if (_pickedFileLeaveForm == null) {
                        _showSnackBar("Please upload the leave document");
                        return;
                      }
                      if (_pickedFile == null && _selectedValue != 3) {
                        _showSnackBar("Please upload a proof document");
                        return;
                      }
                      setState(() => _currentStep = 3);
                  },
                    showBack: true,
                    nextLabel: "Next",
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep3() {
    int leaveDays = _calculateLeaveDays();

    return Stack(
      children:[
        CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildProgressHeader(3),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Info Box
                      Container(
                        decoration: BoxDecoration(
                          color: _successBgColor,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "Leave days taken: $leaveDays",
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.black,
                              ),
                            ),
                            const Text(
                              "500 Rupee",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: _successColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                
                      // Bank Details
                      const SizedBox(height: 24),
                      const Text(
                      "Add receiver's bank details.",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(height: 24),
                      _buildBankField("Bank Holder Name", _accountHolderController,
                          "e.g. Raj Kumar"),
                      const SizedBox(height: 16),
                      _buildBankField(
                          "Bank Name", _bankNameController, "e.g. Raj Kumar"),
                      const SizedBox(height: 16),
                      _buildBankField("Bank Account Number", _accountNumberController,
                          "eg. 123542332"),
                      const SizedBox(height: 16),
                      _buildBankField("IFSC Code", _ifscController, "e.g. UTIB0000000"),
                      
                      // Save Details link
                      const SizedBox(height: 24),
                      Align(
                        alignment: Alignment.centerRight,
                        child: InkWell(
                          onTap: _saveBankDetails,
                          borderRadius: BorderRadius.circular(8),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _isBankSaved ? Icons.bookmark : Icons.bookmark_border,
                                color: _primaryColor,
                                size: 22,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _isBankSaved ? "Saved" : "Save details",
                                style: const TextStyle(
                                  color: _primaryColor,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      // Checkbox
                      const SizedBox(height: 16),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Checkbox(
                            value: _agreeToTerms,
                            onChanged: (val) =>
                                setState(() => _agreeToTerms = val ?? false),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                "I am aware, If I take a mess rebate, I won't be able to eat in mess during those days.",
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[700],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 40),
                
                    ],
                  ),
                ),
              ]
            ),
          ),
          SliverFillRemaining(
            hasScrollBody: false,
            child: Column(
              children: [
                Spacer(),
                _buildBottomButtons(
                  onNext: () async {
                    final now = DateTime.now();
                    if (_lastSubmitTime != null &&
                        now.difference(_lastSubmitTime!) < Duration(seconds: 2)) {
                      return;
                    }
                    _lastSubmitTime = now;
                      
                    if (_isSubmitting) return;
                    if (!_validateStep3()) return;
                    setState(() {
                      _isSubmitting = true;
                    });
                      
                     bool success = false;
                      
                    try {
                      success = await _sendRequest();
                    } catch (e) {
                      success = false;
                    }
                      
                    if (mounted) {
                      setState(() {
                        _isSubmitting = false;
                      });
                      _showStatusDialog(
                        isSuccess: success,
                        title: success ? "Success" : "Failure",
                        message: success
                            ? "Application sent successfully!"
                            : "Something went wrong. Please check your connection and try again.",
                      );
                    }
                },
                  showBack: true,
                  nextLabel: "Submit",
                ),
              ],
            ),
          ),
        ],
      ),
      if (_isSubmitting)
        Positioned.fill(
          child: AbsorbPointer(
            absorbing: true, // blocks all touches
            child: Container(
              color: Colors.black.withOpacity(0.5),
              child: Center(
                child: CircularProgressIndicator(
                  color: _primaryColor,
                ),
              ),
            ),
          ),
        ),

      ],
    );
  }

  Widget _buildProgressHeader(int step) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _borderColor)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Step $step / 3",
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _primaryColor,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: _primaryColor,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: step >= 2 ? _primaryColor : _greyBg,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: step == 3 ? _primaryColor : _greyBg,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBankField(
  String label,
  TextEditingController controller,
  String hint,
) {
  final focusNode = FocusNode();

  return StatefulBuilder(
    builder: (context, setState) {
      bool isFocused = focusNode.hasFocus;
      bool isFilled = controller.text.isNotEmpty;

      Color borderColor = _borderColor;
      Color fillColor = _greyBg;
      Widget? suffixIcon;

      if (isFocused) {
        // Focused state
        borderColor = _primaryColor;
        fillColor = _primaryColor.withOpacity(0.08);
      } else if (isFilled) {
        //Completed state
        borderColor = _borderColor;
        fillColor = _greyBg;
        suffixIcon = const Icon(Icons.check, color: Colors.green);
      }

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.black,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: controller,
            focusNode: focusNode,
            onChanged: (_) {
              setState(() {});
              _onFieldChanged();
            },
            onSubmitted: (_) {
              FocusScope.of(context).unfocus(); // simulate "enter"
              setState(() {});
            },
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: _greyText, fontSize: 14),
              filled: true,
              fillColor: fillColor,
              suffixIcon: suffixIcon,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor, width: 1),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor, width: 1),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: _primaryColor, width: 2),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
          ),
        ],
      );
    },
  );
}

  Widget _buildBottomButtons({
    required VoidCallback onNext,
    required bool showBack,
    required String nextLabel,
  }) {
    return Container(
      decoration: const BoxDecoration(
        color: _greyBg,
        border: Border(top: BorderSide(color: _borderColor)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        children: [
          if (showBack)
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _currentStep = _currentStep == 3 ? 2 : _currentStep == 2 ? 1 : 1),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: _borderColor),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  "Back",
                  style: TextStyle(
                    color: _primaryColor,
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          if (showBack) const SizedBox(width: 8),
          Expanded(
            child: ElevatedButton(
              onPressed: onNext,
              style: ElevatedButton.styleFrom(
                backgroundColor: (_currentStep==1) ? _primaryColor : (_currentStep==2) ? _primaryColor : (_agreeToTerms ? _primaryColor : Color.fromARGB(80, 76, 78, 219)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 0,
              ),
              child: Text(
                nextLabel,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                  fontSize: 16,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _validateStep3() {
    if (_accountHolderController.text.isEmpty ||
        _bankNameController.text.isEmpty ||
        _accountNumberController.text.isEmpty ||
        _ifscController.text.isEmpty) {
      _showSnackBar("Please fill all bank details");
      return false;
    }
    if (!_agreeToTerms) {
      _showSnackBar("Please agree to the terms");
      return false;
    }
    return true;
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showStatusDialog({
    required bool isSuccess,
    required String title,
    required String message,
  }) {
    if (context.mounted) {
      // 1. Pop the upload dialog first
      if (isSuccess) {
        Navigator.pop(context); 
      }

      // 2. Show the Success SnackBar
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isSuccess ? "Upload Successful" : "Upload Failed"),
          // backgroundColor: isSuccess ? _primaryColor : Colors.redAccent,
          // behavior: SnackBarBehavior.fixed,
          duration: const Duration(seconds: 3),
          // shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          // action: isSuccess ? SnackBarAction(
          //   label: 'VIEW LIST',
          //   textColor: Colors.white,
          //   onPressed: () {
          //     Navigator.pushReplacement(
          //       context,
          //       MaterialPageRoute(builder: (context) => const LeaveApplicationListScreen()),
          //     );
          //   },
          // ) : null,
        ),
      );
    }
    
//   showDialog(
//     context: context,
//     builder: (BuildContext context) {
//       return Dialog(
//         shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
//         elevation: 0,
//         backgroundColor: Colors.white,
//         insetPadding: const EdgeInsets.symmetric(horizontal: 40),
//         child: Padding(
//           padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
//           child: Column(
//             mainAxisSize: MainAxisSize.min,
//             children: [
//               // Subtle Minimalist Icon
//               Container(
//                 height: 64,
//                 width: 64,
//                 decoration: BoxDecoration(
//                   // Use primary color with low opacity for the background
//                   color: _primaryColor.withOpacity(0.08),
//                   shape: BoxShape.circle,
//                 ),
//                 child: Icon(
//                   isSuccess ? Icons.check_rounded : Icons.priority_high_rounded,
//                   color: _primaryColor, // Consistent branding
//                   size: 32,
//                 ),
//               ),
//               const SizedBox(height: 24),
              
//               // Text Content
//               Text(
//                 title,
//                 textAlign: TextAlign.center,
//                 style: const TextStyle(
//                   fontSize: 20,
//                   fontWeight: FontWeight.w600,
//                   color: Color(0xFF1A1A1A),
//                   letterSpacing: -0.2,
//                 ),
//               ),
//               const SizedBox(height: 8),
//               Text(
//                 message,
//                 textAlign: TextAlign.center,
//                 style: TextStyle(
//                   fontSize: 14,
//                   height: 1.4,
//                   color: Colors.grey.shade600,
//                 ),
//               ),
//               const SizedBox(height: 32),
              
//               // Minimalist Primary Button
//               SizedBox(
//                 width: double.infinity,
//                 height: 48,
//                 child: ElevatedButton(
//                   style: ElevatedButton.styleFrom(
//                     backgroundColor: _primaryColor,
//                     shape: RoundedRectangleBorder(
//                       borderRadius: BorderRadius.circular(8),
//                     ),
//                   ),
//                   onPressed: () {
//                     Navigator.pop(context);
//                     if (isSuccess) {
//                       Navigator.pushReplacement(
//                         context,
//                         MaterialPageRoute(
//                           builder: (context) => const LeaveApplicationListScreen(),
//                         ),
//                       );
//                     }
//                   },
//                 ),
//               ),
//             ],
//           ),
//         ),
//       );
//     },
//   );
  }
}
