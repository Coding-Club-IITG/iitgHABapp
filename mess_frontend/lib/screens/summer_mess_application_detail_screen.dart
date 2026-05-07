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
import '../utils/name_case.dart';

class SummerMessApplicationDetailScreen extends StatefulWidget {
  const SummerMessApplicationDetailScreen({
    super.key,
    required this.application,
  });

  final Map<String, dynamic> application;

  @override
  State<SummerMessApplicationDetailScreen> createState() =>
      _SummerMessApplicationDetailScreenState();
}

class _SummerMessApplicationDetailScreenState
    extends State<SummerMessApplicationDetailScreen> {
  bool _ackLoading = false;
  String? _error;
  String? _downloadingDocKey;
  late Map<String, dynamic> _app = widget.application;

  String get _status => (_app['status'] ?? '').toString();
  String get _applicationId => (_app['_id'] ?? '').toString();

  String _formatDateTime(String raw) {
    if (raw.trim().isEmpty) return '';
    try {
      final parsed = DateTime.parse(raw).toLocal();
      final l10n = MaterialLocalizations.of(context);
      final formattedDate = l10n.formatMediumDate(parsed);
      final formattedTime = l10n.formatTimeOfDay(
        TimeOfDay.fromDateTime(parsed),
        alwaysUse24HourFormat: false,
      );
      return '$formattedDate, $formattedTime';
    } catch (_) {
      return '';
    }
  }

  Map<String, dynamic> _mapValue(String key) {
    final value = _app[key];
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return const <String, dynamic>{};
  }

  Widget _field(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF111827),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadAndOpenProof() async {
    final token = context.read<AuthController>().token;
    if (_applicationId.isEmpty || token == null) return;

    setState(() {
      _downloadingDocKey = 'proof';
      _error = null;
    });

    File? downloadedFile;
    String? downloadedFileName;

    try {
      final dl = await ManagerApi.downloadSummerMessProof(
        token: token,
        applicationId: _applicationId,
      );

      final ext = ManagerApi.extFromContentType(dl.contentType);
      final filename =
          'summer-proof-${DateTime.now().millisecondsSinceEpoch}.$ext';
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
      await _showOpenOptionsSheet(file: file, fileName: filename, ext: ext);
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
          _error = 'Failed to download payment proof.\n$e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _downloadingDocKey = null;
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
    final token = context.read<AuthController>().token;
    if (_applicationId.isEmpty || token == null) return;

    setState(() {
      _ackLoading = true;
      _error = null;
    });

    try {
      final data = await ManagerApi.acknowledgeSummerMessApplication(
        token: token,
        applicationId: _applicationId,
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
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _ackLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _mapValue('user');
    final boardingHostel = _mapValue('boardingHostel');
    final appliedHostel = _mapValue('appliedHostel');
    final proofUploaded = (_app['paymentProofUrl'] ?? '')
        .toString()
        .trim()
        .isNotEmpty;
    final totalAmount = ((_app['totalAmount'] as num?)?.toDouble() ?? 0)
        .toStringAsFixed(0);
    final applicationDateTime = _formatDateTime(
      (_app['createdAt'] ?? _app['updatedAt'] ?? '').toString(),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Summer Application',
          style: TextStyle(
            color: Color(0xFF111827),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    toTitleCase((user['name'] ?? '').toString()),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (_status.isEmpty ? 'Pending' : _status),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _field('Roll number', (user['rollNumber'] ?? '').toString()),
                  _field('Email', (user['email'] ?? '').toString()),
                  _field('Date & time', applicationDateTime),
                  _field(
                    'Boarding hostel',
                    (boardingHostel['hostel_name'] ?? '').toString(),
                  ),
                  _field(
                    'Requested hostel',
                    (appliedHostel['hostel_name'] ?? '').toString(),
                  ),
                  _field('Total amount', 'Rs $totalAmount'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Payment proof',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _field('Uploaded', proofUploaded ? 'Yes' : 'No'),
                  const SizedBox(height: 4),
                  FilledButton.icon(
                    onPressed: proofUploaded && _downloadingDocKey == null
                        ? _downloadAndOpenProof
                        : null,
                    icon: _downloadingDocKey == 'proof'
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_rounded),
                    label: Text(
                      _downloadingDocKey == 'proof'
                          ? 'Downloading...'
                          : 'Open payment proof',
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFB91C1C),
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: _status.toLowerCase() == 'pending'
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: FilledButton(
                  onPressed: _ackLoading ? null : _acknowledge,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(_ackLoading ? 'Acknowledging...' : 'Acknowledge'),
                ),
              ),
            )
          : null,
    );
  }
}
