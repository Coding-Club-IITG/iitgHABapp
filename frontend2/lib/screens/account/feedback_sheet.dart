// ─────────────────────────────────────────────────────────────────────────────
// Feedback bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FeedbackSheet extends StatefulWidget {
  final BuildContext rootContext;
  const FeedbackSheet({super.key, required this.rootContext});

  @override
  State<FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<FeedbackSheet> {
  int _type = 0;
  String _frequency = 'always';
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  bool _submitting = false;
  String? _titleError;
  String? _descError;
  final List<File> _screenshots = [];

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _pickScreenshots() async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 80);
    if (picked.isEmpty) return;
    setState(() {
      for (final x in picked) {
        if (_screenshots.length < 5) _screenshots.add(File(x.path));
      }
    });
  }

  void _removeScreenshot(int index) {
    setState(() => _screenshots.removeAt(index));
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final desc = _descController.text.trim();
    if (title.isEmpty) {
      setState(() => _titleError = 'Please enter a title');
      return;
    }
    if (desc.isEmpty) {
      setState(() => _descError = 'Please enter a description');
      return;
    }
    setState(() {
      _titleError = null;
      _descError = null;
      _submitting = true;
    });
    try {
      final token = await getAccessToken();
      if (token == 'error') {
        setState(() => _titleError = 'Not authenticated');
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      final email = prefs.getString('email') ?? '';

      // Gather richer device info
      final deviceInfoPlugin = DeviceInfoPlugin();
      Map<String, dynamic> deviceData = {
        'platform': Platform.operatingSystem,
      };

      if (Platform.isAndroid) {
        final info = await deviceInfoPlugin.androidInfo;
        deviceData = {
          'platform': 'android',
          'model': info.model,
          'brand': info.brand,
          'manufacturer': info.manufacturer,
          'sdkInt': info.version.sdkInt,
          'osVersion': info.version.release,
          'device': info.device,
        };
      } else if (Platform.isIOS) {
        final info = await deviceInfoPlugin.iosInfo;
        deviceData = {
          'platform': 'ios',
          'model': info.model,
          'systemName': info.systemName,
          'systemVersion': info.systemVersion,
          'name': info.name,
          'identifierForVendor': info.identifierForVendor,
        };
      }

      final deviceInfo = jsonEncode(deviceData);

      final formData = FormData.fromMap({
        'title': title,
        'description': desc,
        if (email.isNotEmpty) 'email': email,
        'deviceInfo': deviceInfo,
        'type': _type == 0 ? 'bug' : 'suggestion',
        if (_type == 0 && _frequency.isNotEmpty) 'frequency': _frequency,
        if (_screenshots.isNotEmpty)
          'screenshots': [
            for (final f in _screenshots)
              await MultipartFile.fromFile(
                f.path,
                filename: f.path.split('/').last,
              ),
          ],
      });

      final res = await DioClient().dio.post(
            '$baseUrl/bug-report',
            data: formData,
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );

      if (!mounted) return;
      if (res.statusCode == 200 || res.statusCode == 201) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(widget.rootContext).showSnackBar(
          const SnackBar(content: Text('Feedback submitted. Thank you!')),
        );
      } else {
        setState(() => _titleError = 'Submission failed. Try again.');
      }
    } catch (e) {
      if (mounted) {
        setState(
            () => _titleError = 'Error while sending feedback. Try again.');
      }
      debugPrint('Feedback submission error: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ──────────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Feedback',
                      style: TextStyle(
                          fontFamily: Themes.kFont,
                          fontSize: 20,
                          fontWeight: FontWeight.w500)),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Divider(height: 1, thickness: 1, color: Colors.grey[400]),
              const SizedBox(height: 16),

              // ── Type chips ───────────────────────────────────────────
              const Text('Type',
                  style: TextStyle(
                      fontFamily: Themes.kFont,
                      fontSize: 16,
                      fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _TypeChip(
                    label: 'Issue Report',
                    selected: _type == 0,
                    onTap: () => setState(() => _type = 0),
                    roundRight: false,
                  ),
                  _TypeChip(
                    label: 'Feature Suggestion',
                    selected: _type == 1,
                    onTap: () => setState(() => _type = 1),
                    roundLeft: false,
                  ),
                ],
              ),

              // ── Frequency chips (issue report only) ──────────────────
              if (_type == 0) ...[
                const SizedBox(height: 16),
                const Text('Frequency',
                    style: TextStyle(
                        fontFamily: Themes.kFont,
                        fontSize: 16,
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _TypeChip(
                      label: 'Always',
                      selected: _frequency == 'always',
                      onTap: () => setState(() => _frequency = 'always'),
                      roundRight: false,
                    ),
                    _TypeChip(
                      label: 'Sometimes',
                      selected: _frequency == 'sometimes',
                      onTap: () => setState(() => _frequency = 'sometimes'),
                      roundLeft: false,
                      roundRight: false,
                    ),
                    _TypeChip(
                      label: 'Once',
                      selected: _frequency == 'once',
                      onTap: () => setState(() => _frequency = 'once'),
                      roundLeft: false,
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 16),

              // ── Title ────────────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Give the Title',
                      style: TextStyle(
                          fontFamily: Themes.kFont,
                          fontSize: 16,
                          fontWeight: FontWeight.w500)),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _titleController,
                    builder: (_, v, __) => Text(
                      '${v.text.length} / 20',
                      style: TextStyle(
                          fontFamily: Themes.kFont,
                          fontSize: 12,
                          color: Colors.grey[800]),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _titleController,
                onChanged: (_) => setState(() => _titleError = null),
                maxLength: 20,
                buildCounter: (_,
                        {required currentLength,
                        required isFocused,
                        maxLength}) =>
                    const SizedBox.shrink(),
                decoration: InputDecoration(
                  hintText: 'Context',
                  hintStyle: TextStyle(
                      fontFamily: Themes.kFont, color: Colors.grey[400]),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFDDDDDD)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(
                        color: Color.fromARGB(255, 175, 175, 175)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: Themes.kAccent, width: 1.5),
                  ),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              if (_titleError != null) ...[
                const SizedBox(height: 4),
                Text(
                  _titleError!,
                  style: const TextStyle(
                      fontFamily: Themes.kFont,
                      color: Colors.red,
                      fontSize: 12),
                ),
              ],

              const SizedBox(height: 12),

              // ── Description ──────────────────────────────────────────
              const Text('Describe the feedback',
                  style: TextStyle(
                      fontFamily: Themes.kFont,
                      fontSize: 16,
                      fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              TextField(
                controller: _descController,
                onChanged: (_) => setState(() => _descError = null),
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: 'Context',
                  hintStyle: TextStyle(
                      fontFamily: Themes.kFont, color: Colors.grey[400]),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFDDDDDD))),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(
                        color: Color.fromARGB(255, 175, 175, 175)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: Themes.kAccent, width: 1.5),
                  ),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              if (_descError != null) ...[
                const SizedBox(height: 4),
                Text(
                  _descError!,
                  style: const TextStyle(
                      fontFamily: Themes.kFont,
                      color: Colors.red,
                      fontSize: 12),
                ),
              ],

              const SizedBox(height: 16),

              // ── Screenshots ──────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Screenshots',
                      style: TextStyle(
                          fontFamily: Themes.kFont,
                          fontSize: 16,
                          fontWeight: FontWeight.w500)),
                  Text('${_screenshots.length}/5',
                      style: TextStyle(
                          fontFamily: Themes.kFont,
                          fontSize: 12,
                          color: Colors.grey[500])),
                ],
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    if (_screenshots.length < 5)
                      GestureDetector(
                        onTap: _pickScreenshots,
                        child: Container(
                          width: 72,
                          height: 72,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFDDDDDD)),
                          ),
                          child: Icon(Icons.add_photo_alternate_outlined,
                              color: Colors.grey[500], size: 28),
                        ),
                      ),
                    for (int i = 0; i < _screenshots.length; i++)
                      Stack(
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              image: DecorationImage(
                                image: FileImage(_screenshots[i]),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          Positioned(
                            top: 2,
                            right: 10,
                            child: GestureDetector(
                              onTap: () => _removeScreenshot(i),
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close,
                                    size: 12, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),

        // ── Cancel / Submit ────────────────────────────────────────────
        SizedBox(
          width: double.infinity,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.grey[200],
              border: Border(
                top: BorderSide(color: Colors.grey[300]!, width: 1),
              ),
            ),
            child: Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: SizedBox(
                child: TextButton(
                  onPressed: _submitting ? null : _submit,
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.white,
                    side: const BorderSide(
                        color: Color.fromARGB(255, 202, 202, 202)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              color: Themes.kAccent, strokeWidth: 2),
                        )
                      : const Text('Submit',
                          style: TextStyle(
                              fontFamily: Themes.kFont,
                              color: Themes.kAccent,
                              fontWeight: FontWeight.w500)),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool roundLeft;
  final bool roundRight;

  const _TypeChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.roundLeft = true,
    this.roundRight = true,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
            color: selected ? Colors.grey[200] : Colors.grey[100],
            border: Border.all(
              color: const Color(0xFFCCCCCC),
            ),
            borderRadius: BorderRadius.only(
              topLeft: roundLeft ? const Radius.circular(8) : Radius.zero,
              topRight: roundRight ? const Radius.circular(8) : Radius.zero,
              bottomLeft: roundLeft ? const Radius.circular(8) : Radius.zero,
              bottomRight: roundRight ? const Radius.circular(8) : Radius.zero,
            )),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: Themes.kFont,
            fontSize: 14,
            color: selected ? Themes.kAccent : Colors.grey[800],
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
