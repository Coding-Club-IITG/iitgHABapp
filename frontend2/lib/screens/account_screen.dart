import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/account/feedback_sheet.dart';
import 'package:frontend2/screens/account/hmc_info_screen.dart';
import 'package:frontend2/screens/account/profile_screen.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/widgets/common/custom_linear_progress.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:frontend2/apis/authentication/login.dart' as auth;
import 'package:frontend2/screens/initial_setup_screen.dart'
    show ProfilePictureProvider;

// ─────────────────────────────────────────────────────────────────────────────
// HMC member model & data (now fetched from API)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Shared accent colour
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// AccountScreen  (replaces ProfileScreen as the top-level entry point)
// ─────────────────────────────────────────────────────────────────────────────

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  // ── user data ──────────────────────────────────────────────────────────────
  String name = '';
  String hostel = '';
  String email = '';
  String currMess = '';
  String roomNo = '';
  String phone = '';
  String rollNo = '';

  bool _isLoading = true;
  bool _started = false;

  // ── profile-pic upload state ───────────────────────────────────────────────
  bool _uploading = false;
  bool _canChangePhoto = true;

  // ── edit-profile controllers ───────────────────────────────────────────────
  final TextEditingController _roomController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _roomController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  // Lazy init: called the first time build runs.
  bool _ensureLoaded() {
    if (!_started) {
      _started = true;
      _loadAll();
    }
    return _isLoading;
  }

  Future<void> _loadAll() async {
    setState(() => _isLoading = true);
    await Future.wait([_loadPrefs(), _fetchProfileSettings()]);
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      hostel = prefs.getString('hostel') ?? '';
      name = prefs.getString('name') ?? '';
      email = prefs.getString('email') ?? '';
      currMess = prefs.getString('currMess') ?? '';
      roomNo = prefs.getString('roomNumber') ?? '';
      phone = prefs.getString('phoneNumber') ?? '';
      rollNo = prefs.getString('rollNo') ?? '';
      _roomController.text = roomNo;
      _phoneController.text = phone;
    });
  }

  Future<void> _fetchProfileSettings() async {
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
        });
      }
    } catch (_) {}
  }

  // ── profile picture ────────────────────────────────────────────────────────

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
            ProfilePicture.changeUserProfilePicture,
            data: FormData.fromMap({
              'file':
                  await MultipartFile.fromFile(file.path, filename: picked.name)
            }),
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );
      if (res.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('profilePicture', b64);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile picture updated')),
          );
        }
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

  // ── save editable fields ───────────────────────────────────────────────────

  Future<void> _saveEditableFields() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final newRoom = _roomController.text.trim();
      final newPhone = _phoneController.text.trim();

      final success = await saveUserProfileFields(
        roomNumber: newRoom.isEmpty ? null : newRoom,
        phoneNumber: newPhone.isEmpty ? null : newPhone,
      );

      if (!success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to update profile')),
          );
        }
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('roomNumber', newRoom);
      await prefs.setString('phoneNumber', newPhone);
      if (mounted) {
        setState(() {
          roomNo = newRoom;
          phone = newPhone;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated')),
        );
        // Pop the bottom sheet
        Navigator.of(context).pop();
        // Pop the profile detail screen
        Navigator.of(context).pop();
        // Repush it with updated values
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ProfileScreen(
              name: name,
              hostel: hostel,
              currMess: currMess,
              roomNo: newRoom,
              phone: newPhone,
              rollNo: rollNo,
              email: email,
              uploading: _uploading,
              onPickPhoto: _pickAndUploadPhoto,
              onEdit: _openEditSheet,
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _openEditSheet() {
    _roomController.text = roomNo;
    _phoneController.text = phone;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Edit Profile',
                style: TextStyle(
                    fontFamily: Themes.kFont,
                    fontSize: 16,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            TextField(
              controller: _roomController,
              decoration: InputDecoration(
                labelText: 'Room Number',
                prefixIcon: const Icon(Icons.meeting_room_outlined),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Phone Number',
                prefixIcon: const Icon(Icons.phone_outlined),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                isDense: true,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _saveEditableFields,
                style:
                    ElevatedButton.styleFrom(backgroundColor: Themes.kAccent),
                child: Text(
                  _saving ? 'Saving...' : 'Save',
                  style: const TextStyle(
                      fontFamily: Themes.kFont, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── logout ─────────────────────────────────────────────────────────────────

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Logout',
                  style:
                      TextStyle(fontFamily: Themes.kFont, color: Colors.red))),
        ],
      ),
    );
    if (confirm == true && mounted) {
      await auth.logoutHandler(context);
    }
  }

  // ── feedback bottom sheet ──────────────────────────────────────────────────

  void _openFeedbackSheet() {
    final rootContext = context;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color.fromARGB(
          255, 255, 255, 255), // grey background for whole sheet
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => FeedbackSheet(rootContext: rootContext),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final loading = _ensureLoaded();
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.grey[100],
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Account',
          style: TextStyle(
              fontFamily: Themes.kFont,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: Colors.black),
        ),
        centerTitle: false,
      ),
      body: loading
          ? const Center(
              child: CustomLinearProgress(
                text: 'Loading your details, please wait...',
              ),
            )
          : ListView(
              children: [
                // ── Profile card ──────────────────────────────────────────
                _AccountProfileCard(
                  name: name,
                  hostel: hostel,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ProfileScreen(
                        name: name,
                        hostel: hostel,
                        currMess: currMess,
                        roomNo: roomNo,
                        phone: phone,
                        rollNo: rollNo,
                        email: email,
                        uploading: _uploading,
                        onPickPhoto: _pickAndUploadPhoto,
                        onEdit: _openEditSheet,
                      ),
                    ),
                  ),
                ),

                // const SizedBox(height: 20),
                Container(height: 8, color: Colors.grey[100]),
                Container(height: 24, color: Colors.white),

                // ── Hostel Info ───────────────────────────────────────────
                _SectionHeader(title: 'Hostel Info'),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _CardSettingsRow(
                    iconPath: "assets/icon/id.svg",
                    iconColor: Themes.kAccent,
                    label: 'Know Your HMC',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const HmcInfoScreen()),
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // ── App Settings ──────────────────────────────────────────
                const _SectionHeader(title: 'App Settings'),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      _CardSettingsRow(
                        iconPath: "assets/icon/theme.svg",
                        iconColor: Themes.kAccent,
                        label: 'Appearance',
                        subtitle: 'Light Mode',
                        onTap: () {
                          // Placeholder — no logic yet
                        },
                        roundBottom: false,
                      ),
                      const SizedBox(height: 8),
                      _CardSettingsRow(
                        iconPath: "assets/icon/feedback.svg",
                        iconColor: Themes.kAccent,
                        label: 'App Feedback',
                        onTap: _openFeedbackSheet,
                        roundTop: false,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // ── Logout (plain row, no card) ───────────────────────────
                InkWell(
                  onTap: _logout,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                    child: Row(
                      children: [
                        Icon(Icons.logout, color: Colors.red, size: 22),
                        SizedBox(width: 14),
                        Text(
                          'Logout',
                          style: TextStyle(
                              fontFamily: Themes.kFont,
                              color: Colors.red,
                              fontSize: 15,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account profile card widget
// ─────────────────────────────────────────────────────────────────────────────

class _AccountProfileCard extends StatelessWidget {
  final String name;
  final String hostel;
  final VoidCallback onTap;

  const _AccountProfileCard({
    required this.name,
    required this.hostel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 40),
            child: Row(
              children: [
                // Avatar
                ValueListenableBuilder<String>(
                  valueListenable: ProfilePictureProvider.profilePictureString,
                  builder: (_, value, __) => CircleAvatar(
                    radius: 36,
                    backgroundColor: Colors.grey[200],
                    backgroundImage: value.isNotEmpty
                        ? MemoryImage(base64Decode(value))
                        : const AssetImage('assets/images/default_profile.png')
                            as ImageProvider,
                  ),
                ),
                const SizedBox(width: 20),
                // Name + hostel
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.isEmpty ? '—' : name,
                        style: const TextStyle(
                            fontFamily: Themes.kFont,
                            fontSize: 24,
                            fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hostel.isEmpty ? '—' : calculateHostel(hostel),
                        style: TextStyle(
                            fontFamily: Themes.kFont,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Colors.grey[900]),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.grey, size: 28),
                const SizedBox(width: 12),
              ],
            ),
          ),
        ),
        const Divider(height: 1, thickness: 1, color: Color(0xFFE5E5E5)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Text(
        title,
        style: TextStyle(
          fontFamily: Themes.kFont,
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: Colors.grey[600],
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Card settings row — rounded bordered card matching the design
// ─────────────────────────────────────────────────────────────────────────────

class _CardSettingsRow extends StatelessWidget {
  final String iconPath;
  final Color iconColor;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool roundTop;
  final bool roundBottom;

  const _CardSettingsRow({
    required this.iconPath,
    required this.iconColor,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.roundTop = true,
    this.roundBottom = true,
  });

  @override
  Widget build(BuildContext context) {
    const radius = Radius.circular(12);
    const borderRadius = BorderRadius.only(
      topLeft: radius,
      topRight: radius,
      bottomLeft: radius,
      bottomRight: radius,
    );

    return Container(
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: borderRadius,
          border: Border.all(color: const Color(0xFFE5E5E5), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 4,
              offset: const Offset(0, 1),
            )
          ]),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: Column(
          children: [
            ListTile(
              leading: Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SvgPicture.asset(
                  iconPath,
                ),
              ),
              title: Text(label,
                  style: const TextStyle(
                      fontFamily: Themes.kFont,
                      fontSize: 16,
                      fontWeight: FontWeight.w500)),
              subtitle: subtitle != null
                  ? Text(subtitle!,
                      style: const TextStyle(
                          fontFamily: Themes.kFont, fontSize: 14))
                  : null,
              trailing:
                  const Icon(Icons.chevron_right, color: Colors.grey, size: 20),
              onTap: onTap,
            ),
          ],
        ),
      ),
    );
  }
}
