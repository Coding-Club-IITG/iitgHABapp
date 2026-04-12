import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/screens/leave_form_only_success_screen.dart';
import 'package:frontend2/utils/rebate_academic.dart';
import 'package:frontend2/utils/rebate_form_validation.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Station leave PDF only — no rebate application, no bank or proof steps.
class ImmediateLeaveFormScreen extends StatefulWidget {
  const ImmediateLeaveFormScreen({super.key});

  @override
  State<ImmediateLeaveFormScreen> createState() =>
      _ImmediateLeaveFormScreenState();
}

class _ImmediateLeaveFormScreenState extends State<ImmediateLeaveFormScreen> {
  static const Color _primaryColor = Color(0xFF4C4EDB);
  static const Color _borderColor = Color(0xFFE6E6E6);
  static const Color _greyBg = Color(0xFFF5F5F5);
  static const Color _greyText = Color(0xFF939393);
  static const Color _requiredStarColor = Color(0xFFC62828);

  /// Locked row labels — same source as Account / Profile (`fetchUserDetails` + prefs + hostel cache).
  String _lockName = '';
  String _lockRoll = '';
  String _lockEmail = '';
  String _lockHostel = '';
  String _lockMess = '';

  bool _profileLoading = true;
  bool _submitting = false;
  bool _declarationAccepted = false;
  bool _registeredCurrentSem = true;

  /// 1 = student + editable profile; 2 = leave details + declaration + submit.
  int _currentStep = 1;

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

  @override
  void initState() {
    super.initState();
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
    super.dispose();
  }

  void _applyUserMapToControllers(Map<String, dynamic> m) {
    final roll = (m['rollNumber'] ?? '') as String? ?? '';
    final now = DateTime.now();
    final dept = departmentFromRoll(roll) ?? '';
    final prog = programmeFromRoll(roll) ?? '';
    final semN = suggestedSemesterOrdinal(roll, now);
    _deptController.text = dept;
    _progController.text = prog;
    _semesterController.text = '$semN';
    _roomController.text = (m['roomNumber'] ?? '') as String? ?? '';
    _mobileController.text = (m['phoneNumber'] ?? '') as String? ?? '';
  }

  /// Uses `hostel_name` / `curr_subscribed_mess_name` from GET /users/ when present
  /// (populated server-side). Local [calculateHostelAsync] is only a fallback and
  /// returns "Unknown" if the hostel ID map was never loaded.
  Future<(String, String)> _hostelMessLabelsFromUserJson(
    Map<String, dynamic> m,
  ) async {
    var hostel = (m['hostel_name'] ?? '').toString().trim();
    var mess = (m['curr_subscribed_mess_name'] ?? '').toString().trim();
    if (hostel == 'null') hostel = '';
    if (mess == 'null') mess = '';
    if (hostel.isEmpty) {
      final hid = m['hostel']?.toString().trim() ?? '';
      if (hid.isNotEmpty) {
        final r = await calculateHostelAsync(hid);
        if (r.isNotEmpty && r != 'Unknown') hostel = r;
      }
    }
    if (mess.isEmpty) {
      final mid = m['curr_subscribed_mess']?.toString().trim() ?? '';
      if (mid.isNotEmpty) {
        final r = await calculateHostelAsync(mid);
        if (r.isNotEmpty && r != 'Unknown') mess = r;
      }
    }
    return (hostel, mess);
  }

  Future<void> _loadProfile() async {
    final token = await getAccessToken();
    if (token == 'error') {
      setState(() => _profileLoading = false);
      return;
    }

    Future<void> setLocksFromApiMap(Map<String, dynamic> m) async {
      final name = (m['name'] ?? '') as String? ?? '';
      final roll = (m['rollNumber'] ?? '') as String? ?? '';
      final email = (m['email'] ?? '') as String? ?? '';
      final resolved = await _hostelMessLabelsFromUserJson(m);
      if (!mounted) return;
      setState(() {
        _lockName = name;
        _lockRoll = roll;
        _lockEmail = email;
        _lockHostel = resolved.$1;
        _lockMess = resolved.$2;
      });
    }

    try {
      await fetchUserDetails();
      final prefs = await SharedPreferences.getInstance();
      final roll = (prefs.getString('rollNo') ?? '').trim();
      final now = DateTime.now();
      final dept = departmentFromRoll(roll) ?? '';
      final prog = programmeFromRoll(roll) ?? '';
      final semN = suggestedSemesterOrdinal(roll, now);

      // Server adds hostel_name / curr_subscribed_mess_name; local ID→name cache often empty → "Unknown".
      var hostelDisplay = '';
      var messDisplay = '';
      try {
        final dio = DioClient().dio;
        final resp = await dio.get(
          UserEndpoints.currentUser,
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        );
        if (resp.statusCode == 200 && resp.data is Map) {
          final m = Map<String, dynamic>.from(resp.data as Map);
          final pair = await _hostelMessLabelsFromUserJson(m);
          hostelDisplay = pair.$1;
          messDisplay = pair.$2;
        }
      } catch (_) {}
      if (hostelDisplay.isEmpty) {
        final hid = (prefs.getString('hostel') ?? '').trim();
        if (hid.isNotEmpty) hostelDisplay = await calculateHostelAsync(hid);
      }
      if (messDisplay.isEmpty) {
        final mid = (prefs.getString('currMess') ?? '').trim();
        if (mid.isNotEmpty) messDisplay = await calculateHostelAsync(mid);
      }

      if (!mounted) return;
      setState(() {
        _lockName = (prefs.getString('name') ?? '').trim();
        _lockRoll = roll;
        _lockEmail = (prefs.getString('email') ?? '').trim();
        _lockHostel = hostelDisplay;
        _lockMess = messDisplay;
        _deptController.text = dept;
        _progController.text = prog;
        _semesterController.text = '$semN';
        _roomController.text = (prefs.getString('roomNumber') ?? '').trim();
        _mobileController.text = (prefs.getString('phoneNumber') ?? '').trim();
        _profileLoading = false;
      });
    } catch (_) {
      try {
        final dio = DioClient().dio;
        final resp = await dio.get(
          UserEndpoints.currentUser,
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        );
        if (resp.statusCode == 200 && resp.data is Map) {
          final m = Map<String, dynamic>.from(resp.data as Map);
          _applyUserMapToControllers(m);
          await setLocksFromApiMap(m);
          if (!mounted) return;
          setState(() => _profileLoading = false);
        } else {
          setState(() => _profileLoading = false);
        }
      } catch (_) {
        if (mounted) setState(() => _profileLoading = false);
      }
    }
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
    DateTime firstDate = base;
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

  bool _step1Ok() {
    return _homeAddressController.text.trim().isNotEmpty &&
        _mobileController.text.trim().isNotEmpty &&
        _deptController.text.trim().isNotEmpty &&
        _progController.text.trim().isNotEmpty &&
        _semesterController.text.trim().isNotEmpty &&
        _roomController.text.trim().isNotEmpty;
  }

  bool _formOk() {
    return _step1Ok() &&
        _lockName.trim().isNotEmpty &&
        _lockRoll.trim().isNotEmpty &&
        _lockHostel.trim().isNotEmpty &&
        _lockMess.trim().isNotEmpty &&
        _purposeController.text.trim().isNotEmpty &&
        _contactAddrController.text.trim().isNotEmpty &&
        _contactPhoneController.text.trim().isNotEmpty &&
        _startDate != null &&
        _endDate != null &&
        !_endDate!.isBefore(_startDate!) &&
        _inclusiveDays() >= 1 &&
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

  String? _typeErrorContactPhone() {
    final p = _contactPhoneController.text.trim();
    if (p.isNotEmpty &&
        !RebateFormValidation.isValidIndiaContactPhone(p)) {
      return 'Enter a valid contact phone (10-digit mobile, or 10–12 digits).';
    }
    return null;
  }

  void _back() {
    if (_currentStep > 1) {
      setState(() => _currentStep--);
    }
  }

  void _nextOrSubmit() {
    if (_currentStep == 1) {
      if (!_step1Ok()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please complete all required fields in this step'),
          ),
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
    _submit();
  }

  Future<void> _submit() async {
    if (!_formOk()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete all required fields')),
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
    final phoneType = _typeErrorContactPhone();
    if (phoneType != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(phoneType)),
      );
      return;
    }
    final token = await getAccessToken();
    if (token == 'error') return;

    setState(() => _submitting = true);
    try {
      final dio = DioClient().dio;
      final m = FormData.fromMap({
        'startDate': DateFormat('yyyy-MM-dd').format(_startDate!),
        'endDate': DateFormat('yyyy-MM-dd').format(_endDate!),
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
        'studentName': _lockName.trim(),
        'rollNumber': _lockRoll.trim(),
        'email': _lockEmail.trim(),
        'residentHostel': _lockHostel.trim(),
        'subscribedMessDisplay': _lockMess.trim(),
      });

      final response = await dio.post(
        MessRebateEndpoints.generateFormOnly,
        data: m,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (!mounted) return;
      setState(() => _submitting = false);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        String url = '';
        if (data is Map) {
          url = (data['leaveDocumentUrl'] ?? '') as String? ?? '';
        }
        if (!mounted) return;
        await Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => LeaveFormOnlySuccessScreen(
              leaveDocumentUrl: url,
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
        setState(() => _submitting = false);
        final msg = e.response?.data is Map
            ? (e.response!.data['message']?.toString() ?? 'Error')
            : 'Error';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
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

  InputDecoration _fieldDeco({required BorderRadius borderRadius}) {
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

  Widget _editableField(String label, TextEditingController c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _mandatoryFieldLabel(label),
          const SizedBox(height: 6),
          TextField(
            controller: c,
            onChanged: (_) => setState(() {}),
            decoration: _fieldDeco(borderRadius: BorderRadius.circular(12)),
          ),
        ],
      ),
    );
  }

  Widget _editableMultiline(String label, TextEditingController c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _mandatoryFieldLabel(label),
          const SizedBox(height: 6),
          TextField(
            controller: c,
            minLines: 3,
            maxLines: 6,
            onChanged: (_) => setState(() {}),
            decoration: _fieldDeco(borderRadius: BorderRadius.circular(12)),
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

  /// Same locked fields as mess-rebate leave step 1; values from `fetchUserDetails` / prefs / hostel cache.
  Widget _buildLockedProfileSection() {
    final name = _lockName;
    final roll = _lockRoll;
    final email = _lockEmail;
    final hostel = _lockHostel;
    final mess = _lockMess;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _readOnlyField('Name', name),
        _formPairRow(
          _readOnlyFieldInner(
            'Roll number',
            roll.isEmpty ? '—' : roll,
          ),
          _readOnlyFieldInner(
            'Hostel',
            hostel.isEmpty ? '—' : hostel,
          ),
        ),
        _formPairRow(
          _readOnlyFieldInner(
            'Subscribed Mess',
            mess.isEmpty ? '—' : mess,
          ),
          _readOnlyFieldInner(
            'IITG email',
            email.isEmpty ? '—' : email,
          ),
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
      ],
    );
  }

  Widget _progressHeader() {
    const t = 2;
    final s = _currentStep;
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _borderColor)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
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

  Widget _buildStep1Body() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'You can choose dates from today onward. This flow only generates the hostel leave PDF — it does not create a mess rebate application.',
          style: TextStyle(
            fontSize: 12,
            height: 1.35,
            color: Colors.grey[800],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Student details',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        _buildLockedProfileSection(),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _editableField('Programme', _progController)),
            const SizedBox(width: 12),
            Expanded(child: _editableField('Department', _deptController)),
          ],
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _editableField('Semester', _semesterController)),
            const SizedBox(width: 12),
            Expanded(child: _editableField('Room number', _roomController)),
          ],
        ),
        _editableField('Mobile number', _mobileController),
        _editableMultiline('Home/Permanent address', _homeAddressController),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Checkbox(
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              value: _registeredCurrentSem,
              onChanged: (v) => setState(() => _registeredCurrentSem = v ?? true),
            ),
            Expanded(
              child: Text(
                'Registered in current semester',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey[900],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep2Body() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Dates can start from today. Review your leave period and emergency contacts, then accept the declaration.',
          style: TextStyle(
            fontSize: 12,
            height: 1.35,
            color: Colors.grey[800],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Leave details',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        _editableMultiline('Purpose of station leave', _purposeController),
        const Text(
          'Duration',
          style: TextStyle(fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _dateTile('From', _startDate, () => _pickDate(start: true)),
            const SizedBox(width: 12),
            _dateTile('To', _endDate, () => _pickDate(start: false)),
          ],
        ),
        const SizedBox(height: 12),
        _editableMultiline(
          'Contact address during leave (emergency)',
          _contactAddrController,
        ),
        _editableField('Contact phone (emergency)', _contactPhoneController),
        const SizedBox(height: 8),
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
                padding: EdgeInsets.only(top: 10),
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
                        text: 'I declare that the information above is true and accurate. '
                            'I understand this generates a leave form only (not a mess rebate application) '
                            'and that falsification may result in disciplinary action.',
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

  Widget _dateTile(String label, DateTime? d, VoidCallback onTap) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _mandatoryFieldLabel(label),
          const SizedBox(height: 6),
          InkWell(
            onTap: onTap,
            child: InputDecorator(
              decoration: _fieldDeco(
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
      ),
    );
  }

  Widget _profileLoadingBody() {
    return ShimmerHost(
      builder: (context, box) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                box(height: 14, width: 72, borderRadius: BorderRadius.circular(6)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: box(height: 4, borderRadius: BorderRadius.circular(999)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: box(height: 4, borderRadius: BorderRadius.circular(999)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(height: 1, color: _borderColor),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: box(height: 12, borderRadius: BorderRadius.circular(6)),
                  ),
                  const SizedBox(height: 8),
                  box(height: 12, width: 280, borderRadius: BorderRadius.circular(6)),
                  const SizedBox(height: 24),
                  box(height: 18, width: 140, borderRadius: BorderRadius.circular(6)),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: box(height: 48, borderRadius: BorderRadius.circular(12)),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: box(height: 72, borderRadius: BorderRadius.circular(12))),
                      const SizedBox(width: 12),
                      Expanded(child: box(height: 72, borderRadius: BorderRadius.circular(12))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: box(height: 72, borderRadius: BorderRadius.circular(12))),
                      const SizedBox(width: 12),
                      Expanded(child: box(height: 72, borderRadius: BorderRadius.circular(12))),
                    ],
                  ),
                  const SizedBox(height: 20),
                  box(height: 18, width: 100, borderRadius: BorderRadius.circular(6)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: box(height: 56, borderRadius: BorderRadius.circular(12))),
                      const SizedBox(width: 12),
                      Expanded(child: box(height: 56, borderRadius: BorderRadius.circular(12))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: box(height: 56, borderRadius: BorderRadius.circular(12))),
                      const SizedBox(width: 12),
                      Expanded(child: box(height: 56, borderRadius: BorderRadius.circular(12))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: box(height: 56, borderRadius: BorderRadius.circular(12)),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: box(height: 88, borderRadius: BorderRadius.circular(12)),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      box(height: 22, width: 22, borderRadius: BorderRadius.circular(4)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            box(height: 14, width: 220, borderRadius: BorderRadius.circular(6)),
                            const SizedBox(height: 8),
                            box(height: 14, width: 180, borderRadius: BorderRadius.circular(6)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Container(
            decoration: const BoxDecoration(
              color: _greyBg,
              border: Border(top: BorderSide(color: _borderColor)),
            ),
            padding: EdgeInsets.fromLTRB(
              16,
              12,
              16,
              12 + MediaQuery.paddingOf(context).bottom,
            ),
            child: Row(
              children: [
                Expanded(child: box(height: 48, borderRadius: BorderRadius.circular(12))),
                const SizedBox(width: 12),
                Expanded(flex: 2, child: box(height: 48, borderRadius: BorderRadius.circular(12))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_profileLoading) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: Colors.white,
          iconTheme: const IconThemeData(color: Colors.black),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Generate leave form',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w500,
                  fontSize: 20,
                ),
              ),
              Text(
                'PDF only · No mess rebate',
                style: TextStyle(fontSize: 12, color: Color(0xFF676767)),
              ),
            ],
          ),
        ),
        body: _profileLoadingBody(),
      );
    }

    final lastStep = _currentStep == 2;
    final canPrimary = !_submitting &&
        (lastStep ? _formOk() : _step1Ok());

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.black),
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
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Generate leave form',
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w500,
                fontSize: 20,
              ),
            ),
            Text(
              'PDF only · No mess rebate',
              style: TextStyle(fontSize: 12, color: Color(0xFF676767)),
            ),
          ],
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
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: _currentStep == 1
                    ? _buildStep1Body()
                    : _buildStep2Body(),
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                color: _greyBg,
                border: Border(top: BorderSide(color: _borderColor)),
              ),
              padding: EdgeInsets.fromLTRB(
                16,
                12,
                16,
                12 + MediaQuery.paddingOf(context).bottom,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _submitting
                          ? null
                          : () {
                              if (_currentStep == 1) {
                                Navigator.pop(context);
                              } else {
                                _back();
                              }
                            },
                      child: Text(_currentStep == 1 ? 'Cancel' : 'Back'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: canPrimary ? _nextOrSubmit : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _primaryColor,
                        foregroundColor: Colors.white,
                        disabledForegroundColor: _greyText,
                        disabledBackgroundColor: const Color(0xFFE0E0E0),
                        surfaceTintColor: Colors.transparent,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _submitting && lastStep
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              lastStep ? 'Generate form' : 'Next',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
