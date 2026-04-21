import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../apis/manager_api.dart';
import '../providers/auth_controller.dart';
import '../utils/rebate_formatting.dart';
import '../utils/name_case.dart';

class RebateApplicationDetailScreen extends StatefulWidget {
  const RebateApplicationDetailScreen({
    super.key,
    required this.application,
  });

  final Map<String, dynamic> application;

  @override
  State<RebateApplicationDetailScreen> createState() =>
      _RebateApplicationDetailScreenState();
}

class _RebateApplicationDetailScreenState
    extends State<RebateApplicationDetailScreen> {
  bool _ackLoading = false;
  String? _error;
  late Map<String, dynamic> _app = widget.application;
  String? _downloadingDocKey;

  String get _status =>
      (_app['status'] ?? widget.application['status'] ?? '').toString();

  String _guessFileExt(Uri uri) {
    final p = uri.path.toLowerCase();
    if (p.endsWith('.pdf')) return 'pdf';
    if (p.endsWith('.png')) return 'png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'jpg';
    return 'bin';
  }

  Future<void> _downloadAndOpen({
    required String label,
    required String url,
    required String docKey,
  }) async {
    final u = url.trim();
    if (u.isEmpty) return;
    final uri = Uri.tryParse(u);
    if (uri == null) return;

    final token = context.read<AuthController>().token;
    if (token == null) return;

    setState(() {
      _downloadingDocKey = docKey;
      _error = null;
    });

    File? downloadedFile;
    String? downloadedFileName;

    try {
      final dl = await ManagerApi.downloadLeaveDocument(
        token: token,
        documentUrl: u,
      );

      final ext = ManagerApi.extFromContentType(dl.contentType) != 'bin'
          ? ManagerApi.extFromContentType(dl.contentType)
          : _guessFileExt(uri);
      final safeLabel =
          label.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-');
      final filename =
          '$safeLabel-${DateTime.now().millisecondsSinceEpoch}.$ext';
      final docsDir = await getApplicationDocumentsDirectory();
      final downloadsDir = Directory('${docsDir.path}/downloads');
      if (!await downloadsDir.exists()) {
        await downloadsDir.create(recursive: true);
      }
      final file = File('${downloadsDir.path}/$filename');
      await file.writeAsBytes(dl.bytes, flush: true);
      downloadedFile = file;
      downloadedFileName = filename;

      if (!mounted) return;

      await _showOpenOptionsSheet(
        file: file,
        fileName: filename,
        ext: ext,
      );
    } on MissingPluginException catch (_) {
      if (!mounted) return;
      final f = downloadedFile;
      if (f == null) {
        setState(() {
          _error =
              'Could not open file because it was not downloaded successfully.';
        });
        return;
      }
      final fileUri = Uri.file(f.path);
      final ok = await canLaunchUrl(fileUri);
      if (ok) {
        await launchUrl(fileUri, mode: LaunchMode.externalApplication);
      } else {
        if (!mounted) return;
        final name = downloadedFileName ?? 'file';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Downloaded $name, but could not open it.')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to download $label.\n$e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          if (_downloadingDocKey == docKey) _downloadingDocKey = null;
        });
      }
    }
  }

  Future<void> _showOpenOptionsSheet({
    required File file,
    required String fileName,
    required String ext,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Downloaded',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  fileName,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () async {
                    Navigator.of(ctx).pop();
                    await OpenFilex.open(file.path);
                  },
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Open'),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () async {
                    Navigator.of(ctx).pop();
                    final box = context.findRenderObject() as RenderBox?;
                    Rect? origin;
                    if (box != null && box.hasSize) {
                      final topLeft = box.localToGlobal(Offset.zero);
                      origin = topLeft & box.size;
                    }
                    await Share.shareXFiles(
                      [
                        XFile(
                          file.path,
                          name: fileName,
                          mimeType: ext == 'pdf' ? 'application/pdf' : null,
                        ),
                      ],
                      subject: fileName,
                      sharePositionOrigin: origin,
                    );
                  },
                  icon: const Icon(Icons.ios_share),
                  label: const Text('Share / Save to Files'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _acknowledge() async {
    final id = _app['_id']?.toString() ?? '';
    if (id.isEmpty) return;
    final token = context.read<AuthController>().token;
    if (token == null) return;

    setState(() {
      _ackLoading = true;
      _error = null;
    });
    try {
      final data = await ManagerApi.acknowledgeMessRebateApplication(
        token: token,
        applicationId: id,
      );
      final updated = data['updatedApplication'];
      if (updated is Map) {
        setState(() {
          _app = Map<String, dynamic>.from(updated);
        });
      } else {
        setState(() {
          _app = {..._app, 'status': 'Acknowledged'};
        });
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _ackLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _app['user'] is Map
        ? Map<String, dynamic>.from(_app['user'] as Map)
        : const <String, dynamic>{};
    final name = toTitleCase((user['name'] ?? '').toString());
    final roll = (user['rollNumber'] ?? '').toString().trim();

    final leaveType = (_app['leaveType'] ?? '').toString().trim();
    final start = safeParseIsoDate(_app['startDate']);
    final end = safeParseIsoDate(_app['endDate']);
    final duration = (start != null && end != null)
        ? '${formatYyyyMmDdIst(start)} to ${formatYyyyMmDdIst(end)}'
        : '';
    final days = (start != null && end != null)
        ? () {
            final s = DateTime(start.year, start.month, start.day);
            final e = DateTime(end.year, end.month, end.day);
            final diff = e.difference(s).inDays;
            if (diff < 0) return null;
            return diff + 1; // inclusive of both start and end date
          }()
        : null;

    final proofUrl = (_app['proofDocumentUrl'] ?? '').toString().trim();
    final leavePdfUrl = (_app['leaveDocumentUrl'] ?? '').toString().trim();

    final showProof = leaveType.toLowerCase() == 'medical' ||
        leaveType.toLowerCase() == 'academic';
    final canAck = _status.toLowerCase() == 'pending';

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Application',
          style: TextStyle(
            color: Color(0xFF111827),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      floatingActionButton: canAck
          ? FloatingActionButton.extended(
              onPressed: _ackLoading ? null : _acknowledge,
              backgroundColor: const Color(0xFF111827),
              foregroundColor: Colors.white,
              icon: _ackLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.done),
              label: const Text(
                'Acknowledge',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            )
          : null,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name.isEmpty ? 'Student' : name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    roll.isEmpty ? '' : roll,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _KeyValueRow(label: 'Status:', value: _status),
                  _KeyValueRow(
                    label: 'Leave Type:',
                    value: leaveType.isEmpty ? '—' : leaveType,
                  ),
                  _KeyValueRow(
                    label: 'Leave Duration:',
                    value: duration.isEmpty ? '—' : duration,
                  ),
                  _KeyValueRow(
                    label: 'No. of Days:',
                    value: days == null ? '—' : '$days ${days == 1 ? 'day' : 'days'}',
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(
                  color: Color(0xFFB91C1C),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Documents',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF111827),
                    ),
                  ),
                  if (showProof)
                    _DocButton(
                      label: 'Proof document',
                      url: proofUrl,
                      loading: _downloadingDocKey == 'proof',
                      onTap: () => _downloadAndOpen(
                        label: 'Proof document',
                        url: proofUrl,
                        docKey: 'proof',
                      ),
                    ),
                  _DocButton(
                    label: 'Hostel Leave application',
                    url: leavePdfUrl,
                    loading: _downloadingDocKey == 'leave',
                    onTap: () => _downloadAndOpen(
                      label: 'Hostel Leave application',
                      url: leavePdfUrl,
                      docKey: 'leave',
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

class _KeyValueRow extends StatelessWidget {
  const _KeyValueRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF111827),
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF374151),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DocButton extends StatelessWidget {
  const _DocButton({
    required this.label,
    required this.url,
    required this.onTap,
    this.loading = false,
  });

  final String label;
  final String url;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: (loading || url.trim().isEmpty) ? null : onTap,
        icon: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.download),
        label: Text(label),
      ),
    );
  }
}
