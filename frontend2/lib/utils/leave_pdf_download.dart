import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Fetches the PDF from [leaveDocumentUrl], saves it locally, then opens the
/// system share sheet so the user can save to Files / Downloads / Drive, etc.
/// (Avoids opening the link in an external browser.)
Future<void> downloadAndShareLeavePdf(
  BuildContext context,
  String leaveDocumentUrl,
) async {
  if (leaveDocumentUrl.isEmpty) return;
  try {
    EasyLoading.show(status: 'Downloading…');
    final uri = Uri.parse(leaveDocumentUrl);
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
      options: Options(responseType: ResponseType.bytes),
    );
    final data = resp.data;
    if (data == null || data.isEmpty) {
      EasyLoading.dismiss();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not download PDF (empty).')),
        );
      }
      return;
    }
    final dir = await getTemporaryDirectory();
    final name = 'station-leave-${DateTime.now().millisecondsSinceEpoch}.pdf';
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(data, flush: true);
    EasyLoading.dismiss();

    if (!context.mounted) return;

    final box = context.findRenderObject() as RenderBox?;
    Rect? origin;
    if (box != null && box.hasSize) {
      final topLeft = box.localToGlobal(Offset.zero);
      origin = topLeft & box.size;
    }

    // Do not pass [text] — on Android, "Save to Downloads" often writes that
    // string as a separate tiny .txt file next to the PDF.
    await Share.shareXFiles(
      [
        XFile(
          file.path,
          mimeType: 'application/pdf',
          name: name,
        ),
      ],
      subject: 'Hostel leave form',
      sharePositionOrigin: origin,
    );
  } catch (e) {
    EasyLoading.dismiss();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Download failed: $e')),
      );
    }
  }
}

/// Download bytes from [url] and open the share sheet (no [text] — avoids extra
/// Android “text” files). [fileName] should include an extension.
Future<void> downloadAndShareFromUrl(
  BuildContext context,
  String url,
  String fileName,
  String mimeType,
) async {
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
      options: Options(responseType: ResponseType.bytes),
    );
    final data = resp.data;
    if (data == null || data.isEmpty) {
      EasyLoading.dismiss();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not download file (empty).')),
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
      subject: safeName,
      sharePositionOrigin: origin,
    );
  } catch (e) {
    EasyLoading.dismiss();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Download failed: $e')),
      );
    }
  }
}
