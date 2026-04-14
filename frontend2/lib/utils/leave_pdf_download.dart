import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

String _downloadFailureMessage(Object e) {
  if (e is DioException) {
    final code = e.response?.statusCode;
    if (code == 403 || code == 401) {
      return 'This file link has expired or is no longer valid. Please contact '
          'your hostel office if you need a fresh copy of the leave form.';
    }
  }
  return 'Download failed. Please try again later or contact support if the '
      'problem continues.';
}

/// Same network + temp file + share sheet flow as [downloadAndShareLeavePdf].
/// Optional [requestHeaders] (e.g. `Authorization`) for same-origin API URLs.
Future<void> downloadAndShareDocumentFromUrl(
  BuildContext context,
  String url, {
  required String fileName,
  required String mimeType,
  required String shareSubject,
  String emptyDownloadMessage = 'Could not download document (empty).',
  Map<String, String>? requestHeaders,
}) async {
  if (url.isEmpty) return;
  try {
    EasyLoading.show(status: 'Downloading…');
    final uri = Uri.parse(url);
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 120),
        followRedirects: true,
        validateStatus: (s) => s != null && s >= 200 && s < 400,
      ),
    );
    final resp = await dio.getUri<List<int>>(
      uri,
      options: Options(
        responseType: ResponseType.bytes,
        headers: requestHeaders,
      ),
    );
    final data = resp.data;
    if (data == null || data.isEmpty) {
      EasyLoading.dismiss();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(emptyDownloadMessage)),
        );
      }
      return;
    }
    final dir = await getTemporaryDirectory();
    final safeName =
        fileName.replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_').trim();
    final file = File('${dir.path}/$safeName');
    await file.writeAsBytes(data, flush: true);
    EasyLoading.dismiss();

    if (!context.mounted) return;

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
          mimeType: mimeType,
          name: safeName,
        ),
      ],
      subject: shareSubject,
      sharePositionOrigin: origin,
    );
  } catch (e) {
    EasyLoading.dismiss();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_downloadFailureMessage(e))),
      );
    }
  }
}

/// Fetches the PDF from [leaveDocumentUrl], saves it locally, then opens the
/// system share sheet so the user can save to Files / Downloads / Drive, etc.
/// (Avoids opening the link in an external browser.)
Future<void> downloadAndShareLeavePdf(
  BuildContext context,
  String leaveDocumentUrl,
) async {
  if (leaveDocumentUrl.isEmpty) return;
  final name = 'station-leave-${DateTime.now().millisecondsSinceEpoch}.pdf';
  await downloadAndShareDocumentFromUrl(
    context,
    leaveDocumentUrl,
    fileName: name,
    mimeType: 'application/pdf',
    shareSubject: 'Hostel leave form',
    emptyDownloadMessage: 'Could not download PDF (empty).',
  );
}

/// Download bytes from [url] and open the share sheet (no [text] — avoids extra
/// Android “text” files). [fileName] should include an extension.
Future<void> downloadAndShareFromUrl(
  BuildContext context,
  String url,
  String fileName,
  String mimeType,
) async {
  await downloadAndShareDocumentFromUrl(
    context,
    url,
    fileName: fileName,
    mimeType: mimeType,
    shareSubject: fileName,
    emptyDownloadMessage: 'Could not download file (empty).',
  );
}
