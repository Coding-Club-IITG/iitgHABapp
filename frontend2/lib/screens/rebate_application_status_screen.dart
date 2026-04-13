import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/utils/leave_pdf_download.dart';
import 'package:frontend2/widgets/common/page_loading_shimmer.dart';
import 'package:intl/intl.dart';

abstract final class _RbUi {
  static const Color primary = Color(0xFF4C4EDB);
  static const Color primaryBg = Color(0xFFEDEDFB);
  static const Color primaryBorder = Color(0xFFB9B9F4);
  static const Color border = Color(0xFFE6E6E6);
  static const Color grey1 = Color(0xFF535353);
  static const Color grey2 = Color(0xFF2E2F31);
  static const Color dividerBar = Color(0xFFF0F0F0);
  static const Color footerBg = Color(0xFFF5F5F5);
  static const Color cancelBg = Color(0xFFFEF6F6);
  static const Color semanticRed = Color(0xFFC40205);
}

/// Detail view for one mess rebate application: dates, downloads, late medical
/// upload, and rebate status progression.
class RebateApplicationStatusScreen extends StatefulWidget {
  const RebateApplicationStatusScreen({
    super.key,
    required this.applicationId,
    required this.listSnapshot,
    this.onUpdated,
  });

  final String applicationId;
  final Map<String, dynamic> listSnapshot;
  final VoidCallback? onUpdated;

  @override
  State<RebateApplicationStatusScreen> createState() =>
      _RebateApplicationStatusScreenState();
}

class _RebateApplicationStatusScreenState
    extends State<RebateApplicationStatusScreen> {
  Map<String, dynamic>? _app;
  bool _loading = true;
  String? _error;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _app = Map<String, dynamic>.from(widget.listSnapshot);
    if (_status == 'cancelled') {
      _loading = false;
      return;
    }
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final token = await getAccessToken();
    if (token == 'error') {
      setState(() {
        _loading = false;
        _error = 'Could not load session';
      });
      return;
    }
    try {
      final dio = DioClient().dio;
      final r = await dio.get(
        MessRebateEndpoints.leaveApplicationById(widget.applicationId),
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      if (!mounted) return;
      if (r.statusCode == 200 && r.data is Map) {
        final m = r.data as Map;
        final raw = m['application'];
        if (raw is Map) {
          setState(() {
            _app = Map<String, dynamic>.from(raw);
            _loading = false;
          });
          return;
        }
      }
      setState(() {
        _loading = false;
        _error = 'Could not load application';
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load application';
        });
      }
    }
  }

  /// Card title line, e.g. "Medical Leave 22 Mar - 5 Apr" (Figma).
  String _fmtCardTitle() {
    final a = _app;
    if (a == null) return '';
    try {
      final start = DateTime.parse(a['startDate'].toString())
          .add(const Duration(days: 1));
      final end = DateTime.parse(a['endDate'].toString())
          .add(const Duration(days: 1));
      final type = (a['leaveType'] ?? 'Leave').toString();
      final s = DateFormat('d MMM').format(start);
      final e = DateFormat('d MMM').format(end);
      return '$type $s - $e';
    } catch (_) {
      return (a['leaveType'] ?? 'Leave').toString();
    }
  }

  String _ordinalDay(int d) {
    if (d >= 11 && d <= 13) return '${d}th';
    switch (d % 10) {
      case 1:
        return '${d}st';
      case 2:
        return '${d}nd';
      case 3:
        return '${d}rd';
      default:
        return '${d}th';
    }
  }

  String? _formatStatusTimestamp(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    try {
      final dt = DateTime.parse(iso).toLocal();
      final month = DateFormat('MMMM').format(dt);
      final time = DateFormat('h:mm a').format(dt);
      return '${_ordinalDay(dt.day)} $month $time';
    } catch (_) {
      return null;
    }
  }

  /// Same style as [_formatStatusTimestamp] but from a resolved [DateTime].
  String _formatTimestampFromDateTime(DateTime dt) {
    final month = DateFormat('MMMM').format(dt);
    final time = DateFormat('h:mm a').format(dt);
    return '${_ordinalDay(dt.day)} $month $time';
  }

  /// When the application is considered delivered to the mess manager:
  /// - Leave starts in the **current** calendar month → same instant as [appliedAt].
  /// - Otherwise → start of the **next** calendar month (local midnight on the 1st).
  /// - If the leave month is already **before** this month, treat as [appliedAt]
  ///   so past applications do not show a future delivery time.
  DateTime? _deliveryToMessManagerAt() {
    final a = _app;
    if (a == null) return null;
    try {
      final leaveStart =
          DateTime.parse(a['startDate'].toString()).add(const Duration(days: 1));
      final appliedRaw = a['appliedAt']?.toString();
      if (appliedRaw == null || appliedRaw.isEmpty) return null;
      final applied = DateTime.parse(appliedRaw).toLocal();
      final now = DateTime.now();
      final startOfThisMonth = DateTime(now.year, now.month, 1);
      final leaveDay = DateTime(leaveStart.year, leaveStart.month, leaveStart.day);
      if (leaveDay.isBefore(startOfThisMonth)) {
        return applied;
      }
      if (leaveStart.year == now.year && leaveStart.month == now.month) {
        return applied;
      }
      return DateTime(now.year, now.month + 1, 1);
    } catch (_) {
      return null;
    }
  }

  bool get _isCasual =>
      (_app?['leaveType'] ?? '').toString().toLowerCase().contains('casual');

  bool get _isMedical =>
      (_app?['leaveType'] ?? '').toString().toLowerCase().contains('medical');

  bool get _isAcademic =>
      (_app?['leaveType'] ?? '').toString().toLowerCase().contains('academic');

  bool get _needsProofSection => _isAcademic || _isMedical;

  bool get _hasProof {
    final u = _app?['proofDocumentUrl']?.toString().trim() ?? '';
    return u.isNotEmpty;
  }

  String? get _proofUrl {
    final u = _app?['proofDocumentUrl']?.toString().trim();
    return (u == null || u.isEmpty) ? null : u;
  }

  String? get _leavePdfUrl {
    final u = _app?['leaveDocumentUrl']?.toString().trim();
    return (u == null || u.isEmpty) ? null : u;
  }

  String get _status =>
      (_app?['status'] ?? '').toString().toLowerCase().trim();

  bool get _canUploadLateMedical {
    if (!_isMedical || _hasProof) return false;
    if (_status != 'pending') return false;
    final appliedRaw = _app?['appliedAt']?.toString();
    if (appliedRaw == null || appliedRaw.isEmpty) return false;
    try {
      final appliedDateParsed = DateTime.parse(appliedRaw);
      final now = DateTime.now();
      final daysDiff = appliedDateParsed
          .add(const Duration(days: 7))
          .difference(now)
          .inDays;
      return daysDiff >= 0;
    } catch (_) {
      return false;
    }
  }

  bool get _canCancel => _status == 'pending';

  String _extFromUrl(String u) {
    final lower = u.split('?').first.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.png')) return 'png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
    return 'pdf';
  }

  String _mimeForExt(String ext) {
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        return 'application/pdf';
    }
  }

  Future<void> _downloadProof() async {
    final url = _proofUrl;
    if (url == null) return;
    final ext = _extFromUrl(url);
    final name =
        'rebate-proof-${widget.applicationId}.${DateTime.now().millisecondsSinceEpoch}.$ext';
    await downloadAndShareFromUrl(context, url, name, _mimeForExt(ext));
  }

  Future<void> _downloadLeavePdf() async {
    final url = _leavePdfUrl;
    if (url == null || !mounted) return;
    await downloadAndShareLeavePdf(context, url);
  }

  Future<void> _pickAndUploadProof() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'png'],
    );
    if (result == null || !mounted) return;
    final picked = result.files.first;
    if (picked.path == null) return;
    const maxSize = 5 * 1024 * 1024;
    if (picked.size > maxSize) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File size must be less than 5 MB')),
      );
      return;
    }
    final token = await getAccessToken();
    if (token == 'error' || !mounted) return;
    setState(() => _uploading = true);
    EasyLoading.show(status: 'Uploading…');
    try {
      final dio = DioClient().dio;
      final formData = FormData.fromMap({
        'proofDocument': await MultipartFile.fromFile(
          picked.path!,
          filename: picked.name,
        ),
      });
      final r = await dio.post(
        MessRebateEndpoints.uploadLateMedicalDocument(widget.applicationId),
        data: formData,
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
        ),
      );
      EasyLoading.dismiss();
      if (!mounted) return;
      setState(() => _uploading = false);
      if (r.statusCode == 200 || r.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document uploaded successfully')),
        );
        widget.onUpdated?.call();
        await _refresh();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to upload document')),
        );
      }
    } catch (_) {
      EasyLoading.dismiss();
      if (mounted) {
        setState(() => _uploading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error uploading document')),
        );
      }
    }
  }

  Future<void> _confirmCancel() async {
    final go = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel application?'),
        content: const Text(
          'This will cancel your mess rebate application. You can submit a new one if needed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: _RbUi.semanticRed),
            child: const Text('Cancel application'),
          ),
        ],
      ),
    );
    if (go != true || !mounted) return;
    EasyLoading.show(status: 'Cancelling…');
    try {
      final token = await getAccessToken();
      if (token == 'error' || !mounted) {
        EasyLoading.dismiss();
        return;
      }
      final dio = DioClient().dio;
      final r = await dio.delete(
        '${MessRebateEndpoints.getApplications}/${widget.applicationId}',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      EasyLoading.dismiss();
      if (!mounted) return;
      if (r.statusCode == 200 || r.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Application cancelled successfully')),
        );
        widget.onUpdated?.call();
        Navigator.of(context).pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to cancel application')),
        );
      }
    } catch (_) {
      EasyLoading.dismiss();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error cancelling application')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          color: _RbUi.grey2,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'Application Status',
          style: TextStyle(
            color: _RbUi.grey2,
            fontWeight: FontWeight.w500,
            fontSize: 20,
            height: 28 / 20,
          ),
        ),
      ),
      body: _loading
          ? buildRebateApplicationStatusLoadingShimmer()
          : _error != null && _app == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : _status == 'cancelled'
                  ? const _CancelledNotViewableBody()
                  : Column(
                  children: [
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _refresh,
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 8, 16, 0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _StatusTimelineCard(
                                        cardTitle: _fmtCardTitle(),
                                        status: _status,
                                        app: _app,
                                        formatTime: _formatStatusTimestamp,
                                        deliveryAt: _deliveryToMessManagerAt(),
                                        formatDeliveredAt:
                                            _formatTimestampFromDateTime,
                                      ),
                                      if (_status == 'processed') ...[
                                        const SizedBox(height: 16),
                                        const _ProcessedSuccessNoteRow(),
                                      ],
                                  ],
                                ),
                              ),
                              ...[
                                const SizedBox(height: 16),
                                Container(height: 8, color: _RbUi.dividerBar),
                                Padding(
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 24, 16, 24),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      if (_needsProofSection) ...[
                                        _SectionBlock(
                                          title: 'Proof Document',
                                          subtitle:
                                              'Check your proof document.',
                                          trailing: _buildProofActions(),
                                        ),
                                        const SizedBox(height: 24),
                                      ] else if (_isCasual) ...[
                                        const _SectionBlock(
                                          title: 'Proof Document',
                                          subtitle:
                                              'Casual leave does not require a proof document.',
                                        ),
                                        const SizedBox(height: 24),
                                      ],
                                      _SectionBlock(
                                        title: 'Hostel Leave Application',
                                        subtitle:
                                            'Download and submit your application at the security desk.',
                                        trailing: _buildLeavePdfAction(),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (_canCancel) _CancelFooter(onCancel: _confirmCancel),
                  ],
                ),
    );
  }

  Widget _buildProofActions() {
    if (_hasProof) {
      return _BrandOutlineButton(
        onPressed: _downloadProof,
        icon: Icons.file_present_outlined,
        label: 'View uploaded document',
      );
    }
    if (_isMedical && _canUploadLateMedical) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton.icon(
            onPressed: _uploading ? null : _pickAndUploadProof,
            icon: _uploading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.upload_file, size: 20),
            label: Text(_uploading ? 'Uploading…' : 'Upload proof'),
            style: FilledButton.styleFrom(
              backgroundColor: _RbUi.primary,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ],
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _RbUi.border),
      ),
      child: Text(
        _isMedical
            ? 'No proof on file. The upload window has ended — contact your hostel office if you need help.'
            : 'No proof document is stored for this application.',
        style: const TextStyle(fontSize: 13, color: _RbUi.grey1, height: 1.35),
      ),
    );
  }

  Widget _buildLeavePdfAction() {
    if (_leavePdfUrl != null) {
      return _BrandOutlineButton(
        onPressed: _downloadLeavePdf,
        icon: Icons.download_rounded,
        label: 'Download Leave form (PDF)',
      );
    }
    return Text(
      'Leave PDF link is not available.',
      style: TextStyle(
          fontSize: 12, color: _RbUi.grey1.withValues(alpha: 0.9)),
    );
  }
}

class _CancelledNotViewableBody extends StatelessWidget {
  const _CancelledNotViewableBody();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.visibility_off_outlined,
                size: 56, color: Color(0xFFBDBDBD)),
            SizedBox(height: 20),
            Text(
              'Cancelled applications cannot be viewed.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Color(0xFF2E2F31),
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProcessedSuccessNoteRow extends StatelessWidget {
  const _ProcessedSuccessNoteRow();

  static const String _body =
      "Your application has been successfully verified by the hostel office. "
      "The amount usually gets credited to the student's account within a month of successful verification. "
      'If it is still not credited, please contact the hostel office.';

  @override
  Widget build(BuildContext context) {
    return const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.info_outline, size: 16, color: _RbUi.grey1),
        SizedBox(width: 8),
        Expanded(
          child: Text(
            _body,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 20 / 14,
              color: _RbUi.grey1,
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionBlock extends StatelessWidget {
  const _SectionBlock({
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            height: 20 / 16,
            color: _RbUi.grey2,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w400,
            height: 18 / 12,
            color: _RbUi.grey1,
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(height: 8),
          trailing!,
        ],
      ],
    );
  }
}

class _BrandOutlineButton extends StatelessWidget {
  const _BrandOutlineButton({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback onPressed;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: _RbUi.primary,
        backgroundColor: _RbUi.primaryBg,
        side: const BorderSide(
          color: _RbUi.primaryBorder,
        ),
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 20 / 14,
            ),
          ),
        ],
      ),
    );
  }
}

class _CancelFooter extends StatelessWidget {
  const _CancelFooter({required this.onCancel});

  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _RbUi.footerBg,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: _RbUi.footerBg,
          border: Border(top: BorderSide(color: Color(0xFFE6E6E6))),
        ),
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          16 + MediaQuery.paddingOf(context).bottom,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: _RbUi.cancelBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: _RbUi.semanticRed,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D000000),
                offset: Offset(0, 1),
                blurRadius: 4,
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onCancel,
              borderRadius: BorderRadius.circular(8),
              child: const SizedBox(
                height: 52,
                child: Center(
                  child: Text(
                    'Cancel Application',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      height: 24 / 16,
                      color: _RbUi.semanticRed,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum _DotKind { complete, active, incomplete }

class _TimelineStepVm {
  const _TimelineStepVm({
    required this.kind,
    required this.title,
    this.subtitle,
  });

  final _DotKind kind;
  final String title;
  final String? subtitle;
}

class _StatusTimelineCard extends StatelessWidget {
  const _StatusTimelineCard({
    required this.cardTitle,
    required this.status,
    required this.app,
    required this.formatTime,
    this.deliveryAt,
    required this.formatDeliveredAt,
  });

  final String cardTitle;
  final String status;
  final Map<String, dynamic>? app;
  final String? Function(String? iso) formatTime;
  /// Resolved instant when the app is considered delivered to the mess manager.
  final DateTime? deliveryAt;
  final String Function(DateTime) formatDeliveredAt;

  static const Color _lineBlue = Color(0xFF4C4EDB);
  static const Color _lineGrey = Color(0xFFE6E6E6);
  static const Color _grey1 = Color(0xFF535353);
  static const Color _grey2 = Color(0xFF2E2F31);

  /// Vertical space after each step (connector runs through this gap).
  static const double _kStepGapAfter = 20;
  /// Reserved height for one subtitle line (font 12, height 18/12) so rows align.
  static const double _kSubtitleLineHeight = 18;

  /// Reference: incomplete → Delivering; active / completed → Received (same copy).
  static const String _step2Delivering = 'Delivering to Mess Manager';
  static const String _step2Received = 'Received by Mess Manager';
  static const String _step3Pending = 'Pending Verification by Mess Manager';
  static const String _step3Verified = 'Verified by Mess Manager';
  static const String _step4Pending = 'Pending Verification by Hostel Office';
  static const String _step4Verified = 'Verified by Hostel Office';

  String _step2Title(bool deliveryComplete) =>
      deliveryComplete ? _step2Received : _step2Delivering;

  String _step3Title(_DotKind kind) {
    switch (kind) {
      case _DotKind.complete:
        return _step3Verified;
      case _DotKind.active:
      case _DotKind.incomplete:
        return _step3Pending;
    }
  }

  String _step4Title(_DotKind kind) {
    switch (kind) {
      case _DotKind.complete:
        return _step4Verified;
      case _DotKind.active:
      case _DotKind.incomplete:
        return _step4Pending;
    }
  }

  bool _deliveryReached(DateTime now) {
    final d = deliveryAt;
    if (d == null) return false;
    return !d.isAfter(now);
  }

  String? _messSubtitleForUi(String s, bool deliveryReached) {
    final d = deliveryAt;
    if (d == null) return null;
    if (s == 'pending' && !deliveryReached) return null;
    return formatDeliveredAt(d);
  }

  List<_TimelineStepVm> _buildSteps() {
    final s = status.toLowerCase().trim();
    final appliedAt = app?['appliedAt']?.toString();
    final ackAt = app?['acknowledgedAt']?.toString();
    final procAt = app?['processedAt']?.toString();
    final t1 = formatTime(appliedAt);
    final t3 = formatTime(ackAt);
    final t4 = formatTime(procAt);
    final now = DateTime.now();
    final reached = _deliveryReached(now);
    final tMess = _messSubtitleForUi(s, reached);

    if (s == 'processed') {
      return [
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: 'Application Submitted',
            subtitle: t1),
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: _step2Title(true),
            subtitle: tMess),
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: _step3Title(_DotKind.complete),
            subtitle: t3),
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: _step4Title(_DotKind.complete),
            subtitle: t4),
      ];
    }
    if (s == 'acknowledged') {
      return [
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: 'Application Submitted',
            subtitle: t1),
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: _step2Title(true),
            subtitle: tMess),
        _TimelineStepVm(
            kind: _DotKind.complete,
            title: _step3Title(_DotKind.complete),
            subtitle: t3),
        _TimelineStepVm(
            kind: _DotKind.active,
            title: _step4Title(_DotKind.active),
            subtitle: null),
      ];
    }
    // pending (default / unknown)
    final step2Kind = reached ? _DotKind.complete : _DotKind.active;
    final step3Kind =
        !reached ? _DotKind.incomplete : _DotKind.active;
    return [
      _TimelineStepVm(
          kind: _DotKind.complete,
          title: 'Application Submitted',
          subtitle: t1),
      _TimelineStepVm(
          kind: step2Kind,
          title: _step2Title(reached),
          subtitle: tMess),
      _TimelineStepVm(
          kind: step3Kind,
          title: _step3Title(step3Kind),
          subtitle: null),
      _TimelineStepVm(
          kind: _DotKind.incomplete,
          title: _step4Title(_DotKind.incomplete),
          subtitle: null),
    ];
  }

  bool _lineAfterIsBlue(int stepIndex, List<_TimelineStepVm> steps) {
    if (stepIndex >= steps.length - 1) return false;
    return steps[stepIndex].kind == _DotKind.complete;
  }

  @override
  Widget build(BuildContext context) {
    final steps = _buildSteps();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE6E6E6)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 16,
            offset: Offset(0, 0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            cardTitle,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 20 / 14,
              color: _grey1,
            ),
          ),
          const SizedBox(height: 16),
          ...List.generate(steps.length, (i) {
            final step = steps[i];
            final last = i == steps.length - 1;
            final lineBlue = !last && _lineAfterIsBlue(i, steps);
            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 32,
                    child: Column(
                      children: [
                        Center(child: _TimelineDot(kind: step.kind)),
                        if (!last)
                          Expanded(
                            child: Align(
                              alignment: Alignment.topCenter,
                              child: Container(
                                width: 2,
                                color: lineBlue ? _lineBlue : _lineGrey,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                          bottom: last ? 0 : _kStepGapAfter),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            step.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              height: 24 / 16,
                              color: _grey2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          SizedBox(
                            height: _kSubtitleLineHeight,
                            width: double.infinity,
                            child: Align(
                              alignment: Alignment.topLeft,
                              child: (step.subtitle != null &&
                                      step.subtitle!.isNotEmpty)
                                  ? Text(
                                      step.subtitle!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w400,
                                        height: 18 / 12,
                                        color: _grey2,
                                      ),
                                    )
                                  : const SizedBox.shrink(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _TimelineDot extends StatelessWidget {
  const _TimelineDot({required this.kind});

  final _DotKind kind;

  static const Color _primary = Color(0xFF4C4EDB);
  static const Color _primaryBg = Color(0xFFEDEDFB);

  @override
  Widget build(BuildContext context) {
    switch (kind) {
      case _DotKind.complete:
        return Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            color: _primary,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, size: 14, color: Colors.white),
        );
      case _DotKind.active:
        return Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: _primaryBg,
            shape: BoxShape.circle,
          ),
          child: Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: _primary,
              shape: BoxShape.circle,
            ),
          ),
        );
      case _DotKind.incomplete:
        return Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: _RbUi.grey1),
          ),
        );
    }
  }
}
