// ─────────────────────────────────────────────────────────────────────────────
// Profile detail sub-screen
// ─────────────────────────────────────────────────────────────────────────────

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

class ProfileScreen extends StatefulWidget {
  final String name;
  final String hostel;
  final String currMess;
  final String roomNo;
  final String phone;
  final String rollNo;
  final String email;
  final VoidCallback onEdit;

  const ProfileScreen({
    super.key,
    required this.name,
    required this.hostel,
    required this.currMess,
    required this.roomNo,
    required this.phone,
    required this.rollNo,
    required this.email,
    required this.onEdit,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _canChangePhoto = false;
  bool _loading = true;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _fetchSettings();
  }

  Future<void> _fetchSettings() async {
    try {
      final token = await getAccessToken();
      if (token == 'error') return;
      final res = await DioClient().dio.get(
            '$baseUrl/profile/settings',
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );
      if (res.statusCode == 200 && mounted) {
        setState(() {
          _canChangePhoto =
              (res.data as Map)['allowProfilePhotoChange'] == true;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAndUploadPhoto() async {
    if (!_canChangePhoto) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Changing profile photo is not allowed now. Please contact the HAB Admin.'),
        ),
      );
      return;
    }
    final XFile? picked =
        await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    final tmpDir = await getTemporaryDirectory();
    final finalPath = '${tmpDir.path}/${picked.name}';
    await FlutterImageCompress.compressAndGetFile(
      picked.path,
      finalPath,
      minWidth: 256,
      minHeight: 256,
      quality: 85,
    );

    final file = File(finalPath);
    final b64 = base64Encode(file.readAsBytesSync());
    ProfilePictureProvider.profilePictureString.value = b64;

    if (!mounted) return;
    setState(() => _uploading = true);
    try {
      final token = await getAccessToken();
      if (token == 'error') throw Exception('Not authenticated');
      final res = await DioClient().dio.post(
            '$baseUrl/profile/picture',
            data: FormData.fromMap({
              'file':
                  await MultipartFile.fromFile(file.path, filename: picked.name)
            }),
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile picture updated')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Profile',
          style: TextStyle(
              fontFamily: Themes.kFont,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: Colors.black),
        ),
        centerTitle: false,
        actions: [
          TextButton(
            onPressed: widget.onEdit,
            child: const Text('Edit',
                style: TextStyle(
                    fontFamily: Themes.kFont,
                    color: Themes.kAccent,
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: _loading
          ? const _ProfileLoadingSkeleton()
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: Column(
                children: [
                  // ── Profile photo ──────────────────────────────────────────────
                  GestureDetector(
                    onTap: _uploading ? null : _pickAndUploadPhoto,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        ValueListenableBuilder<String>(
                          valueListenable:
                              ProfilePictureProvider.profilePictureString,
                          builder: (_, value, __) => CircleAvatar(
                            radius: 68,
                            backgroundColor: Colors.grey[200],
                            backgroundImage: value.isNotEmpty
                                ? MemoryImage(base64Decode(value))
                                : const AssetImage(
                                        'assets/images/default_profile.png')
                                    as ImageProvider,
                          ),
                        ),
                        if (_uploading)
                          const CircularProgressIndicator(
                              color: Themes.kAccent),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Fields ────────────────────────────────────────────────────
                  _ProfileField(
                    iconPath: 'assets/icon/user.svg',
                    label: 'Name',
                    value: widget.name.isEmpty ? '—' : widget.name,
                  ),
                  const Divider(),

                  _ProfileField(
                    iconPath: 'assets/icon/messicon.svg',
                    label: 'Current Mess',
                    value: widget.currMess.isEmpty
                        ? '—'
                        : calculateHostel(widget.currMess),
                  ),
                  const Divider(height: 16, color: Color(0xFFE2E2E2)),

                  // Hostel + Room side by side
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _ProfileField(
                          iconPath: 'assets/icon/hostel.svg',
                          label: 'Hostel',
                          value: widget.hostel.isEmpty
                              ? '—'
                              : calculateHostel(widget.hostel),
                        ),
                      ),
                      Container(
                          width: 1, height: 48, color: const Color(0xFFE2E2E2)),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 16),
                          child: _ProfileField(
                            iconPath: null,
                            label: 'Room No.',
                            value: widget.roomNo.isEmpty ? '—' : widget.roomNo,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16, color: Color(0xFFE2E2E2)),

                  _ProfileField(
                    iconPath: 'assets/icon/rollno.svg',
                    label: 'Roll No.',
                    value: widget.rollNo.isEmpty ? '—' : widget.rollNo,
                  ),
                  const Divider(height: 16, color: Color(0xFFE2E2E2)),

                  if (widget.email.isNotEmpty)
                    _ProfileField(
                      iconPath: 'assets/icon/outlookid.svg',
                      label: 'Outlook Id',
                      value: widget.email,
                    ),
                ],
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile field widget
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileField extends StatelessWidget {
  final String? iconPath;
  final String label;
  final String value;

  const _ProfileField({
    required this.iconPath,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (iconPath != null) ...[
            SvgPicture.asset(iconPath!, width: 24, height: 24),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontFamily: Themes.kFont,
                        fontSize: 14,
                        color: Colors.grey[800],
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 3),
                Text(value,
                    style: const TextStyle(
                        fontFamily: Themes.kFont,
                        fontSize: 20,
                        color: Colors.black,
                        fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileLoadingSkeleton extends StatelessWidget {
  const _ProfileLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Column(
        children: [
          const SizedBox(height: 20),
          const _ProfileShimmerBlock(
            height: 136,
            width: 136,
            radius: BorderRadius.all(Radius.circular(68)),
          ),
          const SizedBox(height: 32),
          const _ProfileShimmerBlock(height: 20, width: 80),
          const SizedBox(height: 16),
          const _ProfileShimmerBlock(height: 56),
          const Divider(height: 24),
          const _ProfileShimmerBlock(height: 56),
          const Divider(height: 24),
          Row(
            children: const [
              Expanded(child: _ProfileShimmerBlock(height: 56)),
              SizedBox(width: 16),
              Expanded(child: _ProfileShimmerBlock(height: 56)),
            ],
          ),
          const Divider(height: 24),
          const _ProfileShimmerBlock(height: 56),
          const Divider(height: 24),
          const _ProfileShimmerBlock(height: 56),
        ],
      ),
    );
  }
}

class _ProfileShimmerBlock extends StatefulWidget {
  final double height;
  final double? width;
  final BorderRadius radius;

  const _ProfileShimmerBlock({
    required this.height,
    this.width,
    this.radius = const BorderRadius.all(Radius.circular(8)),
  });

  @override
  State<_ProfileShimmerBlock> createState() => _ProfileShimmerBlockState();
}

class _ProfileShimmerBlockState extends State<_ProfileShimmerBlock>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _animation = Tween<double>(begin: -1.5, end: 2.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.radius,
            gradient: LinearGradient(
              begin: Alignment(_animation.value - 1, 0),
              end: Alignment(_animation.value + 1, 0),
              colors: const [
                Themes.shimmerBase,
                Themes.shimmerHighlight,
                Themes.shimmerBase,
              ],
              stops: const [0.1, 0.5, 0.9],
            ),
          ),
        );
      },
    );
  }
}
