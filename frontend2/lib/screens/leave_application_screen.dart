import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/rebate_application_success_screen.dart';
import 'package:frontend2/utils/rebate_academic.dart';
import 'package:frontend2/utils/rebate_form_validation.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_svg/flutter_svg.dart';

class LeaveApplicationScreen extends StatefulWidget {
  const LeaveApplicationScreen({super.key, required this.leaveType});
  final int? leaveType;

  @override
  State<LeaveApplicationScreen> createState() => _LeaveApplicationScreenState();
}

class _LeaveApplicationScreenState extends State<LeaveApplicationScreen> {
  static const Color _primaryColor = Color(0xFF4C4EDB);
  static const Color _borderColor = Color(0xFFE6E6E6);
  static const Color _greyBg = Color(0xFFF5F5F5);
  static const Color _greyText = Color(0xFF939393);
  static const Color _requiredStarColor = Color(0xFFC62828);
  static const double _rebatePerDay = 119.0;
  static const String _rebateMinDaysMessage =
      'The number of days should be greater than or equal to 4 to be eligible for mess rebate. '
      "If you don't want a rebate, go back and generate a leave form.";
  static const Color _rebateSummaryMintBg = Color(0xFFE6F4EA);
  int? _selectedValue;
  int _currentStep = 1;

  Map<String, dynamic>? _profile;
  bool _profileLoading = true;

  final TextEditingController _deptController = TextEditingController();
  final TextEditingController _progController = TextEditingController();
  final TextEditingController _roomController = TextEditingController();
  final TextEditingController _mobileController = TextEditingController();
  final TextEditingController _homeAddressController = TextEditingController();
  final TextEditingController _semesterController = TextEditingController();

  final TextEditingController _purposeController = TextEditingController();
  DateTime? _startDate;
  DateTime? _endDate;
  final TextEditingController _contactAddrController = TextEditingController();
  final TextEditingController _contactPhoneController = TextEditingController();

  PlatformFile? _proofFile;

  final TextEditingController _accountNumberController = TextEditingController();
  final TextEditingController _ifscController = TextEditingController();
  final TextEditingController _bankNameController = TextEditingController();
  final TextEditingController _accountHolderController = TextEditingController();

  bool _registeredCurrentSem = true;
  bool _declarationAccepted = false;
  bool _isSubmitting = false;
  DateTime? _lastSubmitTime;

  int get _totalSteps {
    final isCasual = _selectedValue == 1;
    return isCasual ? 3 : 4;
  }

  bool get _isCasual => _selectedValue == 1;

  @override
  void initState() {
    super.initState();
    _selectedValue = widget.leaveType;
    _loadProfile();
  }

  @override
  void dispose() {
    _deptController.dispose();
    _progController.dispose();
    _roomController.dispose();
    _mobileController.dispose();
    _homeAddressController.dispose();
    _semesterController.dispose();
    _purposeController.dispose();
    _contactAddrController.dispose();
    _contactPhoneController.dispose();
    _accountNumberController.dispose();
    _ifscController.dispose();
    _bankNameController.dispose();
    _accountHolderController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final token = await getAccessToken();
    if (token == 'error') {
      setState(() => _profileLoading = false);
      return;
    }
    try {
      final dio = DioClient().dio;
      final resp = await dio.get(
        UserEndpoints.currentUser,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      if (resp.statusCode == 200 && resp.data is Map) {
        final m = Map<String, dynamic>.from(resp.data as Map);
        final roll = (m['rollNumber'] ?? '') as String? ?? '';
        final now = DateTime.now();
        final dept = departmentFromRoll(roll) ?? '';
        final prog = programmeFromRoll(roll) ?? '';
        final semN = suggestedSemesterOrdinal(roll, now);
        setState(() {
          _profile = m;
          _deptController.text = dept;
          _progController.text = prog;
          _semesterController.text = '$semN';
          _roomController.text = (m['roomNumber'] ?? '') as String? ?? '';
          _mobileController.text = (m['phoneNumber'] ?? '') as String? ?? '';
          _profileLoading = false;
        });
        await _loadBankPrefs();
      } else {
        setState(() => _profileLoading = false);
      }
    } catch (_) {
      setState(() => _profileLoading = false);
    }
  }

  Future<void> _loadBankPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _accountHolderController.text = prefs.getString('accountHolder') ?? '';
    _bankNameController.text = prefs.getString('bankName') ?? '';
    _accountNumberController.text = prefs.getString('accountNumber') ?? '';
    _ifscController.text = prefs.getString('ifsc') ?? '';
    setState(() {});
  }

  int _inclusiveDays() {
    if (_startDate == null || _endDate == null) return 0;
    final d = _endDate!.difference(_startDate!).inDays + 1;
    return d < 0 ? 0 : d;
  }

  Future<void> _pickDate({required bool start}) async {
    final today = DateTime.now();
    final base = DateTime(today.year, today.month, today.day);
    final maxStartCalendar = base.add(const Duration(days: 30));
    final firstCasual = base.add(const Duration(days: 2));
    final firstOther = base.add(const Duration(days: 1));
    DateTime firstDate = (_selectedValue == 1) ? firstCasual : firstOther;
    DateTime lastDate = DateTime(2027);
    DateTime? initial;
    if (start) {
      lastDate = maxStartCalendar;
      if (_endDate != null && _endDate!.isBefore(lastDate)) {
        lastDate = _endDate!;
      }
      if (lastDate.isBefore(firstDate)) lastDate = firstDate;
      initial = _startDate ?? firstDate;
    } else {
      firstDate = _startDate ?? firstDate;
      initial = _endDate ?? firstDate;
    }
    if (initial.isBefore(firstDate)) initial = firstDate;
    if (initial.isAfter(lastDate)) initial = lastDate;

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: firstDate,
      lastDate: lastDate,
    );
    if (picked != null) {
      setState(() {
        if (start) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _pickProof() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'png'],
    );
    if (result == null) return;
    final f = result.files.first;
    if (f.size > 5 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File size must be less than 5 MB')),
        );
      }
      return;
    }
    setState(() => _proofFile = f);
  }

  Future<void> _submit() async {
    final now = DateTime.now();
    if (_lastSubmitTime != null &&
        now.difference(_lastSubmitTime!) < const Duration(seconds: 2)) {
      return;
    }
    _lastSubmitTime = now;
    if (_isSubmitting) return;

    if (!_declarationAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the declaration')),
      );
      return;
    }

    final token = await getAccessToken();
    if (token == 'error') return;

    final p = _profile;
    if (p == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile not loaded. Please wait and try again.'),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dio = DioClient().dio;
      final m = FormData.fromMap({
        'leaveType': _selectedValue == 1
            ? 'Casual'
            : (_selectedValue == 2 ? 'Academic' : 'Medical'),
        'startDate': DateFormat('yyyy-MM-dd').format(_startDate!),
        'endDate': DateFormat('yyyy-MM-dd').format(_endDate!),
        'bankAccountNumber': _accountNumberController.text.trim(),
        'bankIFSCCode': _ifscController.text.trim(),
        'bankName': _bankNameController.text.trim(),
        'bankAccountHoldersName': _accountHolderController.text.trim(),
        'homePermanentAddress': _homeAddressController.text.trim(),
        'studentDeptLabel': _deptController.text.trim(),
        'studentProgrammeLabel': _progController.text.trim(),
        'stationLeavePurpose': _purposeController.text.trim(),
        'contactDuringLeaveAddress': _contactAddrController.text.trim(),
        'contactDuringLeavePhone': _contactPhoneController.text.trim(),
        'semesterDisplay': _semesterController.text.trim(),
        'registeredInCurrentSemester': _registeredCurrentSem ? 'true' : 'false',
        'declarationAccepted': 'true',
        'roomNumber': _roomController.text.trim(),
        'phoneNumber': _mobileController.text.trim(),
        'studentName': (p['name'] ?? '').toString().trim(),
        'rollNumber': (p['rollNumber'] ?? '').toString().trim(),
        'email': (p['email'] ?? '').toString().trim(),
        'residentHostel': (p['hostel_name'] ?? '').toString().trim(),
        'subscribedMessDisplay':
            (p['curr_subscribed_mess_name'] ?? '').toString().trim(),
      });

      if (_proofFile != null && _proofFile!.path != null && !_isCasual) {
        m.files.add(MapEntry(
          'proofDocument',
          await MultipartFile.fromFile(
            _proofFile!.path!,
            filename: _proofFile!.name,
          ),
        ));
      }

      final response = await dio.post(
        MessRebateEndpoints.sendApplication,
        data: m,
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
        ),
      );

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        String url = '';
        int amt = (_inclusiveDays() * _rebatePerDay).round();
        if (data is Map) {
          url = (data['leaveDocumentUrl'] ?? '') as String? ?? '';
          final a = data['estimatedRebateAmountInr'];
          if (a is num) amt = a.round();
        }
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('accountHolder', _accountHolderController.text.trim());
        await prefs.setString('bankName', _bankNameController.text.trim());
        await prefs.setString('accountNumber', _accountNumberController.text.trim());
        await prefs.setString('ifsc', _ifscController.text.trim());
        if (!mounted) return;
        await Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => RebateApplicationSuccessScreen(
              leaveDocumentUrl: url,
              estimatedRebateAmountInr: amt,
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Request failed (${response.statusCode})')),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        final msg = e.response?.data is Map
            ? (e.response!.data['message']?.toString() ?? 'Error')
            : 'Error';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (e) {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  bool _step1Ok() {
    if (_profile == null) return false;
    final p = _profile!;
    final name = (p['name'] ?? '').toString().trim();
    final roll = (p['rollNumber'] ?? '').toString().trim();
    final hostel = (p['hostel_name'] ?? '').toString().trim();
    final mess = (p['curr_subscribed_mess_name'] ?? '').toString().trim();
    return name.isNotEmpty &&
        roll.isNotEmpty &&
        hostel.isNotEmpty &&
        mess.isNotEmpty &&
        _homeAddressController.text.trim().isNotEmpty &&
        _mobileController.text.trim().isNotEmpty &&
        _deptController.text.trim().isNotEmpty &&
        _progController.text.trim().isNotEmpty &&
        _semesterController.text.trim().isNotEmpty &&
        _roomController.text.trim().isNotEmpty;
  }

  bool _step2Ok() {
    if (_startDate == null || _endDate == null) return false;
    if (_endDate!.isBefore(_startDate!)) return false;
    return _purposeController.text.trim().isNotEmpty &&
        _inclusiveDays() >= 4 &&
        _contactAddrController.text.trim().isNotEmpty &&
        _contactPhoneController.text.trim().isNotEmpty;
  }

  bool _step3ProofOk() {
    if (_isCasual) return true;
    if (_selectedValue == 3) return true;
    return _proofFile != null;
  }

  bool _stepBankOk() {
    return _accountHolderController.text.trim().isNotEmpty &&
        _bankNameController.text.trim().isNotEmpty &&
        _accountNumberController.text.trim().isNotEmpty &&
        _ifscController.text.trim().isNotEmpty &&
        _declarationAccepted;
  }

  String? _typeErrorStep1() {
    final mob = _mobileController.text.trim();
    if (mob.isNotEmpty &&
        !RebateFormValidation.isValidIndianMobile(mob)) {
      return 'Enter a valid 10-digit Indian mobile number.';
    }
    final room = _roomController.text.trim();
    if (room.isNotEmpty &&
        !RebateFormValidation.isValidRoomNumber(room)) {
      return 'Room number may only include letters, digits, spaces, hyphen, or slash.';
    }
    final sem = _semesterController.text.trim();
    if (sem.isNotEmpty &&
        !RebateFormValidation.isValidSemesterDisplay(sem)) {
      return 'Enter a valid semester (plain text, up to 64 characters).';
    }
    return null;
  }

  String? _typeErrorStep2() {
    final p = _contactPhoneController.text.trim();
    if (p.isNotEmpty &&
        !RebateFormValidation.isValidIndiaContactPhone(p)) {
      return 'Enter a valid contact phone (10-digit mobile, or 10–12 digits).';
    }
    return null;
  }

  String? _typeErrorStepBank() {
    final acct = _accountNumberController.text.trim();
    if (acct.isNotEmpty &&
        !RebateFormValidation.isValidBankAccountNumber(acct)) {
      return 'Bank account number must be 9–18 digits only.';
    }
    final ifsc = _ifscController.text.trim();
    if (ifsc.isNotEmpty && !RebateFormValidation.isValidIFSC(ifsc)) {
      return 'IFSC must be 11 characters (e.g. SBIN0001234).';
    }
    return null;
  }

  void _next() {
    if (_currentStep == 1) {
      if (!_step1Ok()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please complete all student details')),
        );
        return;
      }
      final step1Type = _typeErrorStep1();
      if (step1Type != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(step1Type)),
        );
        return;
      }
      setState(() => _currentStep = 2);
      return;
    }
    if (_currentStep == 2) {
      if (!_step2Ok()) {
        if (_inclusiveDays() > 0 && _inclusiveDays() < 4) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text(_rebateMinDaysMessage)),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please complete leave details')),
          );
        }
        return;
      }
      final step2Type = _typeErrorStep2();
      if (step2Type != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(step2Type)),
        );
        return;
      }
      setState(() => _currentStep = 3);
      return;
    }
    if (_currentStep == 3 && !_isCasual) {
      if (!_step3ProofOk()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please upload proof (Academic) or skip only for Medical with later upload')),
        );
        return;
      }
      setState(() => _currentStep = 4);
      return;
    }
    if ((_currentStep == 3 && _isCasual) || (_currentStep == 4 && !_isCasual)) {
      if (!_stepBankOk()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Complete bank details and declaration')),
        );
        return;
      }
      final bankType = _typeErrorStepBank();
      if (bankType != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(bankType)),
        );
        return;
      }
      _submit();
    }
  }

  void _back() {
    if (_currentStep > 1) {
      setState(() => _currentStep--);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_profileLoading) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          centerTitle: false,
          titleSpacing: NavigationToolbar.kMiddleSpacing,
          iconTheme: const IconThemeData(color: Colors.black),
          title: const Text(
            'Mess Rebate',
            style: TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.w500,
              fontSize: 20,
            ),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: ShimmerHost(
          builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                box(height: 14, width: 100),
                const SizedBox(height: 20),
                box(height: 16, width: 220),
                const SizedBox(height: 16),
                for (int i = 0; i < 3; i++) ...[
                  Container(
                    width: double.infinity,
                    margin: EdgeInsets.only(bottom: i < 2 ? 12 : 0),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      border: Border.all(color: _borderColor),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        box(height: 24, width: 24, borderRadius: BorderRadius.circular(6)),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              box(height: 16, width: 140),
                              const SizedBox(height: 8),
                              SizedBox(
                                width: double.infinity,
                                child: box(
                                  height: 12,
                                  width: double.infinity,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleSpacing: NavigationToolbar.kMiddleSpacing,
        iconTheme: const IconThemeData(color: Colors.black),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Mess Rebate',
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w500,
                fontSize: 20,
              ),
            ),
            Text(
              _subtitle(),
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_currentStep == 1) {
              Navigator.pop(context);
            } else {
              _back();
            }
          },
        ),
      ),
      body: PopScope(
        canPop: _currentStep == 1,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          _back();
        },
        child: Column(
          children: [
            _progressHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: _buildStepBody(),
              ),
            ),
            _bottomBar(),
          ],
        ),
      ),
    );
  }

  String _subtitle() {
    switch (_selectedValue) {
      case 1:
        return 'Casual Leave';
      case 2:
        return 'Academic Leave';
      case 3:
        return 'Medical Leave';
      default:
        return '';
    }
  }

  Widget _progressHeader() {
    final t = _totalSteps;
    final s = _currentStep;
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _borderColor)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Step $s / $t',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _primaryColor,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(t, (i) {
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i < t - 1 ? 8 : 0),
                  child: Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: i < s ? _primaryColor : _greyBg,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildStepBody() {
    if (_currentStep == 1) return _buildStudentStep();
    if (_currentStep == 2) return _buildLeaveStep();
    if (_currentStep == 3) {
      return _isCasual ? _buildBankStep() : _buildProofStep();
    }
    return _buildBankStep();
  }

  Widget _buildStudentStep() {
    final p = _profile!;
    final name = (p['name'] ?? '') as String? ?? '';
    final roll = (p['rollNumber'] ?? '') as String? ?? '';
    final email = (p['email'] ?? '') as String? ?? '';
    final hostel = (p['hostel_name'] ?? '') as String? ?? '';
    final mess = (p['curr_subscribed_mess_name'] ?? '') as String? ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Student details',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _readOnlyField('Name', name),
        _formPairRow(
          _readOnlyFieldInner('Roll number', roll.isEmpty ? '—' : roll),
          _readOnlyFieldInner('Hostel', hostel.isEmpty ? '—' : hostel),
        ),
        _formPairRow(
          _readOnlyFieldInner(
            'Subscribed Mess',
            mess.isEmpty ? '—' : mess,
          ),
          _readOnlyFieldInner('IITG email', email.isEmpty ? '—' : email),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text(
            'The fields marked with a lock are fixed from institute records and cannot be '
            'changed here. To update them, please contact the Hostel Affairs Board.',
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              color: Colors.grey[800],
            ),
          ),
        ),
        _formPairRow(
          _editableFieldInner('Programme', _progController),
          _editableFieldInner('Department', _deptController),
        ),
        _formPairRow(
          _editableFieldInner('Semester', _semesterController),
          _editableFieldInner('Room number', _roomController),
        ),
        _editableField('Mobile number', _mobileController),
        _editableMultiline('Home/Permanent address', _homeAddressController),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Checkbox(
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              value: _registeredCurrentSem,
              onChanged: (v) =>
                  setState(() => _registeredCurrentSem = v ?? true),
            ),
            Expanded(
              child: _mandatoryFieldLabel('Registered in current semester'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLeaveStep() {
    final days = _inclusiveDays();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Leave details',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _editableMultiline('Purpose of station leave', _purposeController),
        const SizedBox(height: 12),
        const Text(
          'Duration',
          style: TextStyle(fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        _formPairRow(
          _dateTileInner('From', _startDate, () => _pickDate(start: true)),
          _dateTileInner('To', _endDate, () => _pickDate(start: false)),
        ),
        if (_startDate != null && _endDate != null) ...[
          if (days < 4) ...[
            const SizedBox(height: 8),
            const Text(
              _rebateMinDaysMessage,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: _requiredStarColor,
                height: 1.35,
              ),
            ),
          ],
        ],
        const SizedBox(height: 16),
        _editableMultiline(
          'Contact address during leave (emergency)',
          _contactAddrController,
        ),
        _editableField('Contact phone (emergency)', _contactPhoneController),
      ],
    );
  }

  static const TextStyle _proofGuidanceStyle = TextStyle(
    fontSize: 13,
    color: Color(0xFF535353),
    height: 1.4,
  );

  Widget _proofGuidanceBullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: _proofGuidanceStyle),
          Expanded(child: Text(text, style: _proofGuidanceStyle)),
        ],
      ),
    );
  }

  Widget _buildProofStep() {
    final isMedical = _selectedValue == 3;
    final guidanceBullets = isMedical
        ? const [
            'Valid proof is usually an official document from IITG Hospital that states you were not present on the leave dates.',
            'If this is an emergency and you do not have documents yet, you can skip this upload now, obtain them afterwards, and upload within 7 days of submitting this application.',
            'If you want to upload multiple proofs, merge them into a single readable PDF and upload that file.',
          ]
        : const [
            'Valid proof may be an invitation email for an educational event or competition, or any department-approved document that confirms you will be off campus for the leave period.',
            'If you want to upload multiple proofs, merge them into a single readable PDF and upload that file.',
          ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Valid proof',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ...guidanceBullets.map(_proofGuidanceBullet),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: _selectedValue == 2
              ? _mandatoryFieldLabel('Proof document')
              : const Text(
                  'Proof document (optional)',
                  style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                ),
        ),
        GestureDetector(
          onTap: _pickProof,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: _borderColor),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                SvgPicture.asset(
                  'assets/icon/download-2-line.svg',
                  width: 20,
                  height: 20,
                  colorFilter: const ColorFilter.mode(
                    _primaryColor,
                    BlendMode.srcIn,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _proofFile?.name ?? 'Upload PDF / JPG / PNG (max 5 MB)',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (_proofFile != null)
                  const Icon(Icons.check, color: Colors.green),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBankStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Bank details',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _formPairRow(
          _editableFieldInner('Account Holder Name', _accountHolderController),
          _editableFieldInner('Bank name', _bankNameController),
        ),
        _formPairRow(
          _editableFieldInner('Account number', _accountNumberController),
          _editableFieldInner('IFSC', _ifscController),
        ),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: _declarationAccepted,
              onChanged: (v) =>
                  setState(() => _declarationAccepted = v ?? false),
            ),
            const Expanded(
              child: Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text.rich(
                  TextSpan(
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.35,
                      color: Color(0xFF424242),
                    ),
                    children: [
                      TextSpan(
                        text: '* ',
                        style: TextStyle(
                          color: _requiredStarColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      TextSpan(
                        text: 'I declare that all information and documents submitted in this application are true and accurate. '
                            'I am also aware that availing a mess rebate will disallow me from dining in the mess during the applied dates. '
                            'I understand that any falsification may result in disciplinary action.',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _mandatoryFieldLabel(String label) {
    return Text.rich(
      TextSpan(
        style: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 14,
          color: Colors.black,
        ),
        children: [
          TextSpan(text: label),
          const TextSpan(
            text: ' *',
            style: TextStyle(
              color: _requiredStarColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _formPairRow(Widget left, Widget right) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: left),
          const SizedBox(width: 12),
          Expanded(child: right),
        ],
      ),
    );
  }

  Widget _readOnlyFieldInner(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.lock_outline, size: 18, color: Colors.grey.shade600),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: _greyBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _borderColor),
          ),
          child: Text(
            value,
            style: const TextStyle(fontSize: 14),
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _readOnlyField(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _readOnlyFieldInner(label, value),
    );
  }

  Widget _editableFieldInner(
    String label,
    TextEditingController c, {
    bool required = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        required
            ? _mandatoryFieldLabel(label)
            : Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 14,
                ),
              ),
        const SizedBox(height: 6),
        TextField(
          controller: c,
          onChanged: (_) => setState(() {}),
          decoration: _normalFieldDecoration(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ],
    );
  }

  Widget _editableField(
    String label,
    TextEditingController c, {
    bool required = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _editableFieldInner(label, c, required: required),
    );
  }

  Widget _editableMultiline(
    String label,
    TextEditingController c, {
    bool required = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          required
              ? _mandatoryFieldLabel(label)
              : Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
          const SizedBox(height: 6),
          TextField(
            controller: c,
            minLines: 3,
            maxLines: 6,
            onChanged: (_) => setState(() {}),
            decoration: _normalFieldDecoration(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _normalFieldDecoration({required BorderRadius borderRadius}) {
    final outline = OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: const BorderSide(color: _borderColor),
    );
    return InputDecoration(
      filled: false,
      border: outline,
      enabledBorder: outline,
      focusedBorder: OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide: const BorderSide(color: _primaryColor, width: 1.5),
      ),
    );
  }

  Widget _dateTileInner(
    String label,
    DateTime? d,
    VoidCallback onTap, {
    bool required = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        required
            ? _mandatoryFieldLabel(label)
            : Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 14,
                ),
              ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          child: InputDecorator(
            decoration: _normalFieldDecoration(
              borderRadius: BorderRadius.circular(12),
            ).copyWith(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 14,
              ),
            ),
            child: Text(
              d == null ? 'Select' : DateFormat('dd/MM/yyyy').format(d),
              style: TextStyle(
                color: d == null ? _greyText : Colors.black,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _bottomBar() {
    final last = _currentStep == _totalSteps;
    final can = last
        ? (_stepBankOk() && !_isSubmitting)
        : (_currentStep == 1
            ? _step1Ok()
            : _currentStep == 2
                ? _step2Ok()
                : _currentStep == 3 && !_isCasual
                    ? _step3ProofOk()
                    : true);

    final days = _inclusiveDays();
    final rebateTotal = days * _rebatePerDay;
    final showRebateFooter = _currentStep == 2 &&
        _startDate != null &&
        _endDate != null &&
        days >= 4;

    final String primaryLabel = last
        ? 'Submit'
        : (_currentStep == 3 &&
                !_isCasual &&
                _selectedValue == 3 &&
                _proofFile == null)
            ? 'Skip for now'
            : 'Next';

    return Container(
      decoration: const BoxDecoration(
        color: _greyBg,
        border: Border(top: BorderSide(color: _borderColor)),
      ),
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        16 + MediaQuery.of(context).padding.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showRebateFooter) ...[
            const Text(
              'Total refund you will get:',
              style: TextStyle(
                fontSize: 14,
                height: 1.3,
                fontWeight: FontWeight.w500,
                color: Color(0xFF535353),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: _rebateSummaryMintBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      'Leave days taken: $days',
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.3,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF2E2F31),
                      ),
                    ),
                  ),
                  Text(
                    '${rebateTotal.toStringAsFixed(0)} Rupee',
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1F8441),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              if (_currentStep > 1)
                Expanded(
                  flex: 2,
                  child: OutlinedButton(
                    onPressed: _back,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _primaryColor,
                      side: const BorderSide(color: _borderColor),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Back'),
                  ),
                ),
              if (_currentStep > 1) const SizedBox(width: 8),
              Expanded(
                flex: _currentStep > 1 ? 3 : 1,
                child: ElevatedButton(
                  onPressed: can ? _next : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    foregroundColor: Colors.white,
                    disabledForegroundColor: _greyText,
                    disabledBackgroundColor: const Color(0xFFE0E0E0),
                    surfaceTintColor: Colors.transparent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _isSubmitting && last
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          primaryLabel,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
