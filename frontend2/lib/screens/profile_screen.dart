import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/main.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
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
// HMC member model & static data
// ─────────────────────────────────────────────────────────────────────────────

class HmcMember {
  final String name;
  final String email;
  final String phone;
  final String? photoAsset; // optional local asset path

  const HmcMember({
    required this.name,
    required this.email,
    required this.phone,
    this.photoAsset,
  });
}

class HmcRole {
  final String title;
  final List<HmcMember> members;

  const HmcRole({required this.title, required this.members});
}

// Replace with your actual HMC data.
const List<HmcRole> kHmcRoles = [
  HmcRole(
    title: 'General Secretary',
    members: [
      HmcMember(
        name: 'Nimesh',
        email: 'v.vasu@iitg.ac.in',
        phone: '7084415423',
      ),
    ],
  ),
  HmcRole(
    title: 'Maintenance Secretary',
    members: [
      HmcMember(
        name: 'Nimesh',
        email: 'v.vasu@iitg.ac.in',
        phone: '7084415423',
      ),
      HmcMember(
        name: 'Nimesh',
        email: 'v.vasu@iitg.ac.in',
        phone: '7084415423',
      ),
    ],
  ),
  HmcRole(
    title: 'Services Secretary',
    members: [
      HmcMember(
        name: 'Nimesh',
        email: 'v.vasu@iitg.ac.in',
        phone: '7084415423',
      ),
      HmcMember(
        name: 'Nimesh',
        email: 'v.vasu@iitg.ac.in',
        phone: '7084415423',
      ),
    ],
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared accent colour
// ─────────────────────────────────────────────────────────────────────────────

const Color kAccent = Color(0xFF4C4EDB);
const String kFont = 'GeneralSans';

// ─────────────────────────────────────────────────────────────────────────────
// AccountScreen  (replaces ProfileScreen as the top-level entry point)
// ─────────────────────────────────────────────────────────────────────────────

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
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
            builder: (_) => _ProfileDetailScreen(
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
                    fontFamily: kFont,
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
                style: ElevatedButton.styleFrom(backgroundColor: kAccent),
                child: Text(
                  _saving ? 'Saving...' : 'Save',
                  style:
                      const TextStyle(fontFamily: kFont, color: Colors.white),
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
                  style: TextStyle(fontFamily: kFont, color: Colors.red))),
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
      builder: (ctx) => _FeedbackSheet(rootContext: rootContext),
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
              fontFamily: kFont,
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
                      builder: (_) => _ProfileDetailScreen(
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
                    iconColor: kAccent,
                    label: 'Know Your HMC',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const _HmcInfoScreen()),
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
                        iconColor: kAccent,
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
                        iconColor: kAccent,
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
                              fontFamily: kFont,
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
                            fontFamily: kFont,
                            fontSize: 24,
                            fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hostel.isEmpty ? '—' : calculateHostel(hostel),
                        style: TextStyle(
                            fontFamily: kFont,
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
          fontFamily: kFont,
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
    final radius = Radius.circular(12);
    final borderRadius = BorderRadius.only(
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
                      fontFamily: kFont,
                      fontSize: 16,
                      fontWeight: FontWeight.w500)),
              subtitle: subtitle != null
                  ? Text(subtitle!,
                      style: const TextStyle(fontFamily: kFont, fontSize: 14))
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

// ─────────────────────────────────────────────────────────────────────────────
// Profile detail sub-screen
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileDetailScreen extends StatelessWidget {
  final String name;
  final String hostel;
  final String currMess;
  final String roomNo;
  final String phone;
  final String rollNo;
  final String email;
  final bool uploading;
  final VoidCallback onPickPhoto;
  final VoidCallback onEdit;

  const _ProfileDetailScreen({
    required this.name,
    required this.hostel,
    required this.currMess,
    required this.roomNo,
    required this.phone,
    required this.rollNo,
    required this.email,
    required this.uploading,
    required this.onPickPhoto,
    required this.onEdit,
  });

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
              fontFamily: kFont,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: Colors.black),
        ),
        centerTitle: false,
        actions: [
          TextButton(
            onPressed: onEdit,
            child: const Text('Edit',
                style: TextStyle(
                    fontFamily: kFont,
                    color: kAccent,
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          children: [
            // ── Profile photo ──────────────────────────────────────────────
            GestureDetector(
              onTap: uploading ? null : onPickPhoto,
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
                  if (uploading)
                    const CircularProgressIndicator(color: kAccent),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // ── Fields ────────────────────────────────────────────────────
            _ProfileField(
              iconPath: 'assets/icon/user.svg',
              label: 'Name',
              value: name.isEmpty ? '—' : name,
            ),
            const _Divider(),

            _ProfileField(
              iconPath: 'assets/icon/messicon.svg',
              label: 'Current Mess',
              value: currMess.isEmpty ? '—' : calculateHostel(currMess),
            ),
            const _Divider(),

            // Hostel + Room side by side
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _ProfileField(
                    iconPath: 'assets/icon/hostel.svg',
                    label: 'Hostel',
                    value: hostel.isEmpty ? '—' : calculateHostel(hostel),
                  ),
                ),
                Container(width: 1, height: 48, color: const Color(0xFFE2E2E2)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: _ProfileField(
                      iconPath: null,
                      label: 'Room No.',
                      value: roomNo.isEmpty ? '—' : roomNo,
                    ),
                  ),
                ),
              ],
            ),
            const _Divider(),

            _ProfileField(
              iconPath: 'assets/icon/rollno.svg',
              label: 'Roll No.',
              value: rollNo.isEmpty ? '—' : rollNo,
            ),
            const _Divider(),

            if (email.isNotEmpty)
              _ProfileField(
                iconPath: 'assets/icon/outlookid.svg',
                label: 'Outlook Id',
                value: email,
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
                        fontFamily: kFont,
                        fontSize: 14,
                        color: Colors.grey[800],
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 3),
                Text(value,
                    style: const TextStyle(
                        fontFamily: kFont,
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

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) =>
      const Divider(height: 16, color: Color(0xFFE2E2E2));
}

// ─────────────────────────────────────────────────────────────────────────────
// HMC Info screen
// ─────────────────────────────────────────────────────────────────────────────

class _HmcInfoScreen extends StatefulWidget {
  const _HmcInfoScreen();

  @override
  State<_HmcInfoScreen> createState() => _HmcInfoScreenState();
}

class _HmcInfoScreenState extends State<_HmcInfoScreen> {
  // Track which member cards are expanded: key = "roleIndex-memberIndex"
  final Set<String> _expanded = {};

  void _toggle(String key) {
    setState(() {
      if (_expanded.contains(key)) {
        _expanded.remove(key);
      } else {
        _expanded.add(key);
      }
    });
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _mail(String email) async {
    final uri = Uri(scheme: 'mailto', path: email);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.grey[50],
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'HMC Info',
          style: TextStyle(
              fontFamily: kFont,
              fontSize: 20,
              fontWeight: FontWeight.w500,
              color: Colors.black),
        ),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        children: [
          for (int ri = 0; ri < kHmcRoles.length; ri++) ...[
            // Role heading
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
              child: Text(
                kHmcRoles[ri].title,
                style: const TextStyle(
                  fontFamily: kFont,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
            ),
            // Member cards
            for (int mi = 0; mi < kHmcRoles[ri].members.length; mi++)
              _HmcMemberCard(
                member: kHmcRoles[ri].members[mi],
                isExpanded: _expanded.contains('$ri-$mi'),
                onToggle: () => _toggle('$ri-$mi'),
                onCall: () => _call(kHmcRoles[ri].members[mi].phone),
                onMail: () => _mail(kHmcRoles[ri].members[mi].email),
              ),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HMC member card
// ─────────────────────────────────────────────────────────────────────────────
class _HmcMemberCard extends StatelessWidget {
  final HmcMember member;
  final bool isExpanded;
  final VoidCallback onToggle;
  final VoidCallback onCall;
  final VoidCallback onMail;

  const _HmcMemberCard({
    required this.member,
    required this.isExpanded,
    required this.onToggle,
    required this.onCall,
    required this.onMail,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: isExpanded
              ? Border.all(color: const Color(0xFFDDDDDD), width: 1)
              : null,
        ),
        child: Column(
          children: [
            // ── Collapsed row ─────────────────────────────────────────
            InkWell(
              onTap: onToggle,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: Colors.grey[200],
                      backgroundImage: member.photoAsset != null
                          ? AssetImage(member.photoAsset!)
                          : null,
                      child: member.photoAsset == null
                          ? Text(
                              member.name.isNotEmpty
                                  ? member.name[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                  fontFamily: kFont,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black54),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(member.name,
                              style: const TextStyle(
                                  fontFamily: kFont,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text(member.email,
                              style: TextStyle(
                                  fontFamily: kFont,
                                  fontSize: 14,
                                  color: Colors.grey[800])),
                          Text(member.phone,
                              style: TextStyle(
                                  fontFamily: kFont,
                                  fontSize: 14,
                                  color: Colors.grey[800])),
                        ],
                      ),
                    ),
                    Icon(
                      isExpanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      color: kAccent,
                    ),
                  ],
                ),
              ),
            ),

            // ── Expanded action row ───────────────────────────────────
            if (isExpanded) ...[
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton.icon(
                        onPressed: onCall,
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFFF2F2F2),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadiusGeometry.horizontal(
                                  left: const Radius.circular(8))),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        icon: SvgPicture.asset('assets/icon/call.svg',
                            width: 24, height: 24),
                        label: const Text('Call',
                            style: TextStyle(
                                fontFamily: kFont,
                                color: kAccent,
                                fontWeight: FontWeight.w500,
                                fontSize: 16)),
                      ),
                    ),
                    SizedBox(
                        width: 1,
                        height: 36,
                        child: Container(color: const Color(0xFFE2E2E2))),
                    Expanded(
                      child: TextButton.icon(
                        onPressed: onMail,
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFFF2F2F2),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadiusGeometry.horizontal(
                                  right: const Radius.circular(8))),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        icon: SvgPicture.asset('assets/icon/mail.svg',
                            width: 24, height: 24),
                        label: const Text('Mail',
                            style:
                                TextStyle(fontFamily: kFont, color: kAccent)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
class _FeedbackSheet extends StatefulWidget {
  final BuildContext rootContext;
  const _FeedbackSheet({required this.rootContext});

  @override
  State<_FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<_FeedbackSheet> {
  int _type = 0;
  String _frequency = 'always';
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  bool _submitting = false;
  String? _titleError;
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
    setState(() {
      _titleError = null;
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

      final endpoint =
          _type == 0 ? '$baseUrl/bug-report' : '$baseUrl/suggestion';

      final formData = FormData.fromMap({
        'title': title,
        'description': desc,
        if (email.isNotEmpty) 'email': email,
        'deviceInfo': deviceInfo,
        if (_type == 0) 'frequency': _frequency,
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
            endpoint,
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
      if (mounted) setState(() => _titleError = 'Error: ${e.toString()}');
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
                  const Text('Feedback',
                      style: TextStyle(
                          fontFamily: kFont,
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
                      fontFamily: kFont,
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
                        fontFamily: kFont,
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
                          fontFamily: kFont,
                          fontSize: 16,
                          fontWeight: FontWeight.w500)),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _titleController,
                    builder: (_, v, __) => Text(
                      '${v.text.length} / 20',
                      style: TextStyle(
                          fontFamily: kFont,
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
                  hintStyle:
                      TextStyle(fontFamily: kFont, color: Colors.grey[400]),
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
                    borderSide: const BorderSide(color: kAccent, width: 1.5),
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
                      fontFamily: kFont, color: Colors.red, fontSize: 12),
                ),
              ],

              const SizedBox(height: 12),

              // ── Description ──────────────────────────────────────────
              const Text('Describe the feedback',
                  style: TextStyle(
                      fontFamily: kFont,
                      fontSize: 16,
                      fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              TextField(
                controller: _descController,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: 'Context',
                  hintStyle:
                      TextStyle(fontFamily: kFont, color: Colors.grey[400]),
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
                    borderSide: const BorderSide(color: kAccent, width: 1.5),
                  ),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),

              const SizedBox(height: 16),

              // ── Screenshots ──────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Screenshots',
                      style: TextStyle(
                          fontFamily: kFont,
                          fontSize: 16,
                          fontWeight: FontWeight.w500)),
                  Text('${_screenshots.length}/5',
                      style: TextStyle(
                          fontFamily: kFont,
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
                              color: kAccent, strokeWidth: 2),
                        )
                      : const Text('Submit',
                          style: TextStyle(
                              fontFamily: kFont,
                              color: kAccent,
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
            fontFamily: kFont,
            fontSize: 14,
            color: selected ? kAccent : Colors.grey[800],
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
