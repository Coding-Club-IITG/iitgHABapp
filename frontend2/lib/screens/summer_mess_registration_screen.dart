import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:frontend2/apis/summer_mess/summer_mess_api.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
import 'package:frontend2/screens/summer_mess_application_status_screen.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';
import 'package:frontend2/widgets/microsoft_required_dialog.dart';

abstract final class _SummerMessTheme {
  static const primary = Color(0xFF4C4EDB);
  static const border = Color(0xFFE6E6E6);
  static const textPrimary = Color(0xFF2E2F31);
  static const textSecondary = Color(0xFF676767);
  static const pageBg = Color(0xFFFFFFFF);
  static const neutralSoft = Color(0xFFF5F5F5);
  static const sectionBar = Color(0xFFF0F0F0);
  static const double buttonRadius = 6.0;
  static const double sectionDividerBarHeight = 8.0;
}

/// Space reserved above the scroll body for the floating [_buildStepIndicator] overlay.
/// layout math: padding(16) + "Step N/N" text(20) + gap(8) + progress bar(4) + padding(16) + border(1) ≈ 72
const double _kProgressHeaderSlotHeight = 72.0;

class SummerMessRegistrationScreen extends StatefulWidget {
  const SummerMessRegistrationScreen({super.key});

  @override
  State<SummerMessRegistrationScreen> createState() =>
      _SummerMessRegistrationScreenState();
}

class _SummerMessRegistrationScreenState
    extends State<SummerMessRegistrationScreen> {
  SummerMessStatusData? _status;
  String? _selectedHostelId;
  PlatformFile? _paymentProofFile;
  bool _loading = true;
  bool _submitting = false;
  bool _termsAccepted = false;
  bool _proofDeclarationAccepted = false;
  int _currentStep = 1;

  @override
  void initState() {
    super.initState();
    _checkMicrosoftLink();
    _loadStatus();
  }

  Future<void> _checkMicrosoftLink() async {
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
    final guestIdentifier = prefs.getString('guestIdentifier');

    if (guestIdentifier != null && !hasMicrosoftLinked) {
      if (!mounted) return;
      Navigator.pop(context);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Summer mess registration is available only for student accounts.',
              textAlign: TextAlign.center,
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(40),
          ),
        );
      });
      return;
    }

    if (!hasMicrosoftLinked && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showDialog(
          context: context,
          builder: (context) => const MicrosoftRequiredDialog(
            featureName: 'Summer Mess Registration',
          ),
        );
        Navigator.pop(context);
      });
    }
  }

  Future<void> _loadStatus() async {
    setState(() {
      _loading = true;
    });

    try {
      final status = await fetchSummerMessStatus();
      final availableIds =
          status.availableHostels.map((hostel) => hostel.id).toSet();
      final preferredApplicationHostelId = status.application?.appliedHostelId;
      if (!mounted) return;
      setState(() {
        _status = status;
        _selectedHostelId = preferredApplicationHostelId != null &&
                preferredApplicationHostelId.isNotEmpty &&
                availableIds.contains(preferredApplicationHostelId)
            ? preferredApplicationHostelId
            : (status.availableHostels.isNotEmpty
                ? status.availableHostels.first.id
                : null);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(summerMessApiErrorMessage(error))),
      );
    }
  }

  Future<void> _pickProof() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg'],
    );
    if (result == null) return;
    final picked = result.files.first;
    if (picked.size > 5 * 1024 * 1024) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File size must be less than 5 MB')),
      );
      return;
    }
    setState(() {
      _paymentProofFile = picked;
    });
  }

  Future<void> _submit() async {
    final status = _status;
    final hostelId = _selectedHostelId;
    final paymentProofFile = _paymentProofFile;
    if (status == null || hostelId == null || hostelId.isEmpty) return;
    if (paymentProofFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload your payment proof.')),
      );
      return;
    }
    if (!_proofDeclarationAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please confirm the payment proof declaration.')),
      );
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      await submitSummerMessRegistration(
        hostelId: hostelId,
        registrationTermsAccepted: true,
        paymentProofDeclarationAccepted: _proofDeclarationAccepted,
        paymentProof: paymentProofFile,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Summer mess application submitted.')),
      );
      setState(() {
        _paymentProofFile = null;
        _proofDeclarationAccepted = false;
      });
      await _loadStatus();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(summerMessApiErrorMessage(error))),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _cancelApplication() async {
    final applicationId = _status?.application?.id;
    if (applicationId == null || applicationId.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel application?'),
        content: const Text(
          'This will cancel your summer mess application. You can apply again while the registration window is open.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel application'),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    try {
      await cancelSummerMessApplication(applicationId: applicationId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Summer mess application cancelled.')),
      );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => const MainNavigationScreen(),
        ),
        (route) => false,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(summerMessApiErrorMessage(error))),
      );
    }
  }

  String _formatDateOnly(DateTime? value) {
    if (value == null) return 'Not announced';
    return DateFormat('d MMM yyyy').format(value.toLocal());
  }

  String _formatDateTime(DateTime? value) {
    if (value == null) return 'Not announced';
    return DateFormat('d MMM yyyy, hh:mm a').format(value.toLocal());
  }

  String _formatCurrency(double value) {
    return 'Rs ${value.toStringAsFixed(0)}';
  }

  Widget _summaryInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: _SummerMessTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            value.isEmpty ? '—' : value,
            style: const TextStyle(
              fontSize: 16,
              height: 1.35,
              fontWeight: FontWeight.w500,
              color: _SummerMessTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryPairRow(
    String leftLabel,
    String leftValue,
    String rightLabel,
    String rightValue,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: _summaryInfoRow(leftLabel, leftValue)),
        const SizedBox(width: 16),
        Expanded(child: _summaryInfoRow(rightLabel, rightValue)),
      ],
    );
  }

  Widget _summaryAmountRow(double amount) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          const Expanded(
            child: Text(
              'Total amount',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: _SummerMessTheme.textSecondary,
              ),
            ),
          ),
          Text(
            _formatCurrency(amount),
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w500,
              color: _SummerMessTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  String _selectedHostelName(SummerMessStatusData status) {
    for (final hostel in status.availableHostels) {
      if (hostel.id == _selectedHostelId) return hostel.hostelName;
    }
    return status.application?.appliedHostelName ?? 'selected hostel';
  }

  // ---------------------------------------------------------------------------
  // Section divider — full-bleed 8 px grey bar.
  // Uses Stack + Positioned to bleed past the parent's 16 px padding safely.
  // ---------------------------------------------------------------------------
  Widget _sectionDivider() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SizedBox(
          height: _SummerMessTheme.sectionDividerBarHeight,
          width: constraints.maxWidth,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: -16,
                right: -16,
                top: 0,
                height: _SummerMessTheme.sectionDividerBarHeight,
                child: const ColoredBox(color: _SummerMessTheme.sectionBar),
              ),
            ],
          ),
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Progress header — floats above the scroll body via Stack + Positioned,
  // identical pattern to the rebate page's _progressHeader.
  // ---------------------------------------------------------------------------
  Widget _buildStepIndicator() {
    return Material(
      color: Colors.white,
      elevation: 1,
      surfaceTintColor: Colors.transparent,
      shadowColor: const Color(0x14000000),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: _SummerMessTheme.border)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Step $_currentStep / 2',
              style: const TextStyle(
                fontSize: 14,
                height: 20 / 14,
                fontWeight: FontWeight.w500,
                color: _SummerMessTheme.primary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: List.generate(
                2,
                (index) => Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: index == 0 ? 8 : 0),
                    child: Container(
                      height: 4,
                      decoration: BoxDecoration(
                        color: index < _currentStep
                            ? _SummerMessTheme.primary
                            : _SummerMessTheme.neutralSoft,
                        borderRadius: BorderRadius.circular(9999),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1 — season summary details.
  // Uniform 12 px gap between every detail row (was alternating 10/SizedBox).
  // ---------------------------------------------------------------------------
  Widget _buildSeasonSummarySection(SummerMessStatusData status) {
    final pricing = status.pricing;
    final seasonHeading =
        status.seasonLabel.isEmpty ? 'Summer mess' : status.seasonLabel;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(
          seasonHeading,
          style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 18),
        _summaryInfoRow(
          'Registration window open till',
          _formatDateTime(status.registrationEndAt),
        ),
        const Divider(height: 1, color: _SummerMessTheme.border),
        const SizedBox(height: 16),
        _summaryPairRow(
          'Phase Start Date',
          _formatDateOnly(status.summerStartAt),
          'Phase End Date',
          _formatDateOnly(status.summerEndAt),
        ),
        const SizedBox(height: 4),
        const Divider(height: 1, color: _SummerMessTheme.border),
        const SizedBox(height: 16),
        _summaryPairRow(
          'Total days',
          '${pricing.totalDays}',
          'Rate per day',
          _formatCurrency(pricing.ratePerDay),
        ),
      ],
    );
  }

  Widget _buildStepOne(SummerMessStatusData status) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSeasonSummarySection(status),
        const SizedBox(height: 20),
        _summaryAmountRow(status.pricing.totalAmount),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: _termsAccepted,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              onChanged: (value) {
                setState(() {
                  _termsAccepted = value ?? false;
                });
              },
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 2),
                child: const Text(
                  'I understand that this registration will give me access to my preferred mess only during the dates mentioned above. I will pay the full amount for the entire window. If I need food for only a few days, I will use the pay-and-eat basis.',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: _SummerMessTheme.textPrimary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _lockedValueTile(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: _SummerMessTheme.textSecondary,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.lock_outline_rounded,
                size: 15,
                color: _SummerMessTheme.textSecondary,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: _SummerMessTheme.neutralSoft,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _SummerMessTheme.border),
            ),
            child: Text(
              value.isEmpty ? '—' : value,
              style: const TextStyle(
                fontSize: 14,
                color: _SummerMessTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepTwo(SummerMessStatusData status) {
    final selectedHostelName = _selectedHostelName(status);

    final message =
        'Please pay ${_formatCurrency(status.pricing.totalAmount)} at the $selectedHostelName mess and upload the receipt or payment proof below as a PDF, PNG, or JPEG. Once the mess manager verifies it, your summer mess access for this period will be enabled.';

    const note =
        'Note: The Hostel Affairs Board does not handle any summer mess payments or transactions. Payments must be made directly to the mess manager by visiting the preferred mess in person.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Student details',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _lockedValueTile('Name', status.studentProfile.name),
        Row(
          children: [
            Expanded(
              child: _lockedValueTile(
                'Roll number',
                status.studentProfile.rollNumber,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _lockedValueTile(
                'Boarding hostel',
                status.boardingHostelName,
              ),
            ),
          ],
        ),
        const Text(
          'These fields are locked from institute records and cannot be changed here.',
          style: TextStyle(
            fontSize: 12,
            height: 1.45,
            color: _SummerMessTheme.textSecondary,
          ),
        ),
        const SizedBox(height: 16),
        _sectionDivider(),
        const SizedBox(height: 16),
        const Text('Preferred hostel',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _selectedHostelId,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFFF5F5F5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _SummerMessTheme.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _SummerMessTheme.border),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 14,
            ),
          ),
          items: status.availableHostels
              .map(
                (hostel) => DropdownMenuItem<String>(
                  value: hostel.id,
                  child: Text(hostel.hostelName),
                ),
              )
              .toList(),
          onChanged: status.canApply
              ? (value) {
                  setState(() {
                    _selectedHostelId = value;
                  });
                }
              : null,
        ),
        if (_selectedHostelId != null) ...[
          const SizedBox(height: 14),
          Text(
            message,
            style: const TextStyle(
              fontSize: 13,
              height: 1.5,
              color: _SummerMessTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            note,
            style: TextStyle(
              fontSize: 13,
              height: 1.5,
              color: _SummerMessTheme.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: status.canApply ? _pickProof : null,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            side: const BorderSide(color: _SummerMessTheme.border),
            shape: RoundedRectangleBorder(
              borderRadius:
                  BorderRadius.circular(_SummerMessTheme.buttonRadius),
            ),
          ),
          icon: const Icon(Icons.upload_file_rounded),
          label: Text(
            _paymentProofFile == null
                ? 'Upload payment proof'
                : 'Change uploaded file',
          ),
        ),
        const SizedBox(height: 10),
        Text(
          _paymentProofFile?.name ??
              (status.application?.paymentProofFilename.isNotEmpty == true
                  ? 'Existing proof: ${status.application!.paymentProofFilename}'
                  : 'Accepted formats: PDF, PNG, JPEG. Max size: 5 MB.'),
          style: const TextStyle(
            fontSize: 12,
            color: _SummerMessTheme.textSecondary,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: _proofDeclarationAccepted,
              onChanged: status.canApply
                  ? (value) {
                      setState(() {
                        _proofDeclarationAccepted = value ?? false;
                      });
                    }
                  : null,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'I confirm that the uploaded payment proof is genuine. I understand that submitting false proof can lead to disciplinary action.',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    color: _SummerMessTheme.textPrimary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Bottom action bar — grey background matching the rebate page's _bottomBar.
  // ---------------------------------------------------------------------------
  Widget _bottomActionBar(SummerMessStatusData status) {
    if (status.application != null) return const SizedBox.shrink();

    if (!status.canApply) return const SizedBox.shrink();

    if (_currentStep == 1) {
      return Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: _SummerMessTheme.neutralSoft,
          border: Border(top: BorderSide(color: _SummerMessTheme.border)),
        ),
        padding: EdgeInsets.fromLTRB(
          16,
          12,
          16,
          12,
        ),
        child: ElevatedButton(
          onPressed: _termsAccepted
              ? () {
                  setState(() {
                    _currentStep = 2;
                  });
                }
              : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: _SummerMessTheme.primary,
            foregroundColor: Colors.white,
            disabledBackgroundColor: const Color(0xFFE0E0E0),
            disabledForegroundColor: _SummerMessTheme.textSecondary,
            surfaceTintColor: Colors.transparent,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius:
                  BorderRadius.circular(_SummerMessTheme.buttonRadius),
            ),
          ),
          child: const Text(
            'Start Registration',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      );
    }

    final canSubmit = _selectedHostelId != null &&
        _selectedHostelId!.isNotEmpty &&
        _paymentProofFile != null &&
        _proofDeclarationAccepted;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: _SummerMessTheme.neutralSoft,
        border: Border(top: BorderSide(color: _SummerMessTheme.border)),
      ),
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12,
      ),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: OutlinedButton(
              onPressed: _submitting
                  ? null
                  : () {
                      setState(() {
                        _currentStep = 1;
                      });
                    },
              style: OutlinedButton.styleFrom(
                foregroundColor: _SummerMessTheme.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: _SummerMessTheme.border),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(_SummerMessTheme.buttonRadius),
                ),
              ),
              child: const Text('Back'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 3,
            child: FilledButton(
              onPressed: canSubmit && !_submitting ? _submit : null,
              style: FilledButton.styleFrom(
                backgroundColor: _SummerMessTheme.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFE0E0E0),
                disabledForegroundColor: _SummerMessTheme.textSecondary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(_SummerMessTheme.buttonRadius),
                ),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      status.application == null
                          ? 'Submit application'
                          : 'Update application',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadedBody(SummerMessStatusData status) {
    if (status.application != null) {
      return SummerMessApplicationStatusScreen(
        status: status,
        onCancel: _cancelApplication,
      );
    }

    final scrollBody = SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        16,
        status.canApply ? _kProgressHeaderSlotHeight : 12,
        16,
        24,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (status.canApply) ...[
            if (_currentStep == 1)
              _buildStepOne(status)
            else
              _buildStepTwo(status),
          ] else if (status.application == null) ...[
            _buildSeasonSummarySection(status),
          ],
        ],
      ),
    );

    if (!status.canApply) return scrollBody;

    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(child: scrollBody),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _buildStepIndicator(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _SummerMessTheme.pageBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          color: _SummerMessTheme.textPrimary,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        foregroundColor: _SummerMessTheme.textPrimary,
        shape: const Border(
          bottom: BorderSide(
            color: _SummerMessTheme.border,
            width: 1,
          ),
        ),
        title: const Text(
          'Summer Mess',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w500,
            color: _SummerMessTheme.textPrimary,
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? ShimmerHost(
                builder: (context, box) => SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  child: Column(
                    children: [
                      box(
                        height: 88,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      const SizedBox(height: 16),
                      box(
                        height: 220,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      const SizedBox(height: 16),
                      box(
                        height: 200,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ],
                  ),
                ),
              )
            : PopScope(
                canPop: _currentStep == 1,
                onPopInvokedWithResult: (didPop, _) {
                  if (didPop) return;
                  setState(() => _currentStep = 1);
                },
                child: Column(
                  children: [
                    Expanded(
                      child: _buildLoadedBody(
                        _status ??
                            const SummerMessStatusData(
                              seasonKey: '',
                              seasonLabel: '',
                              shouldShowCard: false,
                              canApply: false,
                              registrationOpen: false,
                              summerActive: false,
                              availableHostels: <SummerMessHostelOption>[],
                              application: null,
                              studentProfile: SummerMessStudentProfileData(
                                name: '',
                                rollNumber: '',
                                email: '',
                              ),
                              pricing: SummerMessPricingData(
                                ratePerDay: 0,
                                totalDays: 0,
                                totalAmount: 0,
                              ),
                              boardingHostelName: '',
                              currentSubscriptionName: '',
                              activeSeasonLabel: '',
                            ),
                      ),
                    ),
                    if (_status != null) _bottomActionBar(_status!),
                  ],
                ),
              ),
      ),
    );
  }
}
