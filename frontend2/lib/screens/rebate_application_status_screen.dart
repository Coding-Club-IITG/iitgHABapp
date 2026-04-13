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
  static const Color _primary = Color(0xFF4C4EDB);
  static const Color _border = Color(0xFFE6E6E6);
  static const Color _muted = Color(0xFF676767);

  Map<String, dynamic>? _app;
  bool _loading = true;
  String? _error;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _app = Map<String, dynamic>.from(widget.listSnapshot);
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

  String _fmtRangeLine() {
    final a = _app;
    if (a == null) return '';
    try {
      final s = DateFormat('d MMM yyyy').format(
        DateTime.parse(a['startDate'].toString()).add(const Duration(days: 1)),
      );
      final e = DateFormat('d MMM yyyy').format(
        DateTime.parse(a['endDate'].toString()).add(const Duration(days: 1)),
      );
      final type = (a['leaveType'] ?? 'Leave').toString();
      return '$type from $s to $e';
    } catch (_) {
      return (a['leaveType'] ?? 'Leave').toString();
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
        titleSpacing: NavigationToolbar.kMiddleSpacing,
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text(
          'Application status',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w500,
            fontSize: 18,
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
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _fmtRangeLine(),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2E2F31),
                          ),
                        ),
                        const SizedBox(height: 20),
                        _RebateStatusStepper(status: _status),
                        const SizedBox(height: 28),
                        if (_needsProofSection) ...[
                          const Text(
                            'Proof document',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2E2F31),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isMedical
                                ? 'Medical certificate (PDF or image). You can upload within 7 days of applying if you did not attach one earlier.'
                                : 'Proof uploaded with your application.',
                            style: const TextStyle(fontSize: 13, color: _muted),
                          ),
                          const SizedBox(height: 12),
                          if (_hasProof)
                            OutlinedButton.icon(
                              onPressed: _downloadProof,
                              icon: const Icon(Icons.download_rounded, size: 20),
                              label: const Text('Download proof'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _primary,
                                side: const BorderSide(color: _border),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                  horizontal: 16,
                                ),
                              ),
                            )
                          else if (_isMedical && _canUploadLateMedical)
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
                              label: Text(
                                  _uploading ? 'Uploading…' : 'Upload proof'),
                              style: FilledButton.styleFrom(
                                backgroundColor: _primary,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                  horizontal: 16,
                                ),
                              ),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF5F5F5),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: _border),
                              ),
                              child: Text(
                                _isMedical
                                    ? 'No proof on file. The upload window has ended — contact your hostel office if you need help.'
                                    : 'No proof document is stored for this application.',
                                style: const TextStyle(
                                    fontSize: 13, color: _muted),
                              ),
                            ),
                          const SizedBox(height: 28),
                        ] else if (_isCasual) ...[
                          const Text(
                            'Proof document',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2E2F31),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Casual leave does not require a proof document.',
                            style: TextStyle(fontSize: 13, color: _muted),
                          ),
                          const SizedBox(height: 28),
                        ],
                        const Text(
                          'Hostel leave application',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2E2F31),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Combined station leave form (PDF).',
                          style: TextStyle(fontSize: 13, color: _muted),
                        ),
                        const SizedBox(height: 12),
                        if (_leavePdfUrl != null)
                          OutlinedButton.icon(
                            onPressed: _downloadLeavePdf,
                            icon: const Icon(Icons.picture_as_pdf_outlined,
                                size: 20),
                            label: const Text('Download leave form (PDF)'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: _primary,
                              side: const BorderSide(color: _border),
                              padding: const EdgeInsets.symmetric(
                                vertical: 12,
                                horizontal: 16,
                              ),
                            ),
                          )
                        else
                          const Text(
                            'Leave PDF link is not available.',
                            style: TextStyle(fontSize: 13, color: _muted),
                          ),
                      ],
                    ),
                  ),
                ),
    );
  }
}

class _RebateStatusStepper extends StatelessWidget {
  const _RebateStatusStepper({required this.status});

  final String status;

  static const Color _lineDone = Color(0xFF4C4EDB);
  static const Color _lineTodo = Color(0xFFE0E0E0);
  static const Color _accent = Color(0xFF4C4EDB);

  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    if (s == 'cancelled') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFEBEE),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFFCDD2)),
        ),
        child: const Row(
          children: [
            Icon(Icons.cancel_outlined, color: Color(0xFFC62828), size: 22),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'This application was cancelled.',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFFB71C1C),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final ackDone = s == 'acknowledged' || s == 'processed';
    final procDone = s == 'processed';

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE6E6E6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Rebate status',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF535353),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StepColumn(
                title: 'Applied',
                subtitle: 'Submitted',
                state: _RailStepState.done,
                accent: _accent,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Container(
                    height: 3,
                    color: ackDone ? _lineDone : _lineTodo,
                  ),
                ),
              ),
              _StepColumn(
                title: 'Acknowledged',
                subtitle: 'Mess office',
                state: ackDone
                    ? _RailStepState.done
                    : (s == 'pending'
                        ? _RailStepState.current
                        : _RailStepState.indexed),
                accent: _accent,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Container(
                    height: 3,
                    color: procDone ? _lineDone : _lineTodo,
                  ),
                ),
              ),
              _StepColumn(
                title: 'Processed',
                subtitle: 'Rebate',
                state: procDone
                    ? _RailStepState.done
                    : (ackDone
                        ? _RailStepState.current
                        : _RailStepState.indexed),
                accent: _accent,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _RailStepState { indexed, current, done }

class _StepColumn extends StatelessWidget {
  const _StepColumn({
    required this.title,
    required this.subtitle,
    required this.state,
    required this.accent,
  });

  final String title;
  final String subtitle;
  final _RailStepState state;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final done = state == _RailStepState.done;
    final current = state == _RailStepState.current;
    final border = done || current ? accent : const Color(0xFFBDBDBD);
    final fill = done ? accent : Colors.white;

    return SizedBox(
      width: 76,
      child: Column(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: fill,
              border: Border.all(color: border, width: 2),
            ),
            child: done
                ? const Icon(Icons.check, size: 14, color: Colors.white)
                : current
                    ? Center(
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: accent,
                          ),
                        ),
                      )
                    : null,
          ),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: TextStyle(
              fontSize: 11,
              fontWeight: current || done ? FontWeight.w600 : FontWeight.w500,
              color: done || current
                  ? const Color(0xFF2E2F31)
                  : const Color(0xFF676767),
              height: 1.15,
            ),
          ),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: TextStyle(
              fontSize: 10,
              color: done
                  ? const Color(0xFF757575)
                  : const Color(0xFF676767),
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}
