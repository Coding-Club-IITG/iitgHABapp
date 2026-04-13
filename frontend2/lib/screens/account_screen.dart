import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/account/feedback_sheet.dart';
import 'package:frontend2/screens/account/hmc_info_screen.dart';
import 'package:frontend2/screens/account/profile_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:frontend2/apis/authentication/login.dart' as auth;
import 'package:frontend2/screens/initial_setup_screen.dart'
    show ProfilePictureProvider;

// ─────────────────────────────────────────────────────────────────────────────
// AccountScreen
// ─────────────────────────────────────────────────────────────────────────────

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  String name = '';
  String hostel = '';
  String hostelName = '';
  String currMess = '';
  String currMessName = '';
  String email = '';
  String roomNo = '';
  String phone = '';
  String rollNo = '';
  bool isGuest = false;

  final TextEditingController _roomController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  @override
  void dispose() {
    _roomController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final guestIdentifier = prefs.getString('guestIdentifier');
    setState(() {
      hostel = prefs.getString('hostel') ?? '';
      hostelName = prefs.getString('hostelName') ?? '';
      name = prefs.getString('name') ?? '';
      email = prefs.getString('email') ?? '';
      currMess = prefs.getString('currMess') ?? '';
      currMessName = prefs.getString('currMessName') ?? '';
      roomNo = prefs.getString('roomNumber') ?? '';
      phone = prefs.getString('phoneNumber') ?? '';
      rollNo = prefs.getString('rollNo') ?? '';
      isGuest = guestIdentifier != null;
      _roomController.text = roomNo;
      _phoneController.text = phone;
    });
  }

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
        Navigator.of(context).pop();
        Navigator.of(context).pop();
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ProfileScreen(
              name: name,
              hostel: hostel,
              hostelName: hostelName,
              currMess: currMess,
              currMessName: currMessName,
              roomNo: newRoom,
              phone: newPhone,
              rollNo: rollNo,
              email: email,
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
                  style: const TextStyle( color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _linkMicrosoftAccount() async {
    try {
      await auth.linkMicrosoftAccount();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Center(
              child: Text(
                'Student Account linked successfully',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(50),
            duration: Duration(milliseconds: 2000),
          ),
        );
        // Reload preferences to update isGuest state
        await _loadPrefs();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Center(
              child: Text(
                'Failed to link Student Account',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(50),
            duration: Duration(milliseconds: 2000),
          ),
        );
      }
    }
  }

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
                      TextStyle( color: Colors.red))),
        ],
      ),
    );
    if (confirm == true && mounted) {
      await auth.logoutHandler(context);
    }
  }

  void _openFeedbackSheet() {
    final rootContext = context;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color.fromARGB(255, 255, 255, 255),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => FeedbackSheet(rootContext: rootContext),
    );
  }

  @override
  Widget build(BuildContext context) {
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
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: Colors.black),
        ),
        centerTitle: false,
      ),
      body: ListView(
        children: [
          // ── Profile card ──────────────────────────────────────────
          _AccountProfileCard(
            name: name,
            hostel: hostel,
            hostelName: hostelName,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ProfileScreen(
                  name: name,
                  hostel: hostel,
                  hostelName: hostelName,
                  currMess: currMess,
                  currMessName: currMessName,
                  roomNo: roomNo,
                  phone: phone,
                  rollNo: rollNo,
                  email: email,
                  onEdit: _openEditSheet,
                ),
              ),
            ),
          ),

          Container(height: 8, color: Colors.grey[100]),
          Container(height: 24, color: Colors.white),

          // ── Hostel Info ───────────────────────────────────────────
          const _SectionHeader(title: 'Hostel Info'),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _CardSettingsRow(
              iconPath: "assets/icon/id.svg",
              iconColor: Themes.kAccent,
              label: 'Know Your HMC',
              subtitle: null,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const HmcInfoScreen()),
              ),
              roundBottom: true,
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
                // _CardSettingsRow(
                //   iconPath: "assets/icon/theme.svg",
                //   iconColor: Themes.kAccent,
                //   label: 'Appearance',
                //   subtitle: 'Light Mode',
                //   onTap: () {},
                //   roundBottom: false,
                // ),
                // const SizedBox(height: 8),
                _CardSettingsRow(
                  iconPath: "assets/icon/feedback.svg",
                  iconColor: Themes.kAccent,
                  label: 'App Feedback',
                  onTap: _openFeedbackSheet,
                  roundTop: true,
                  roundBottom: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),
          // ── Login ──────────────────────────────────────────────
          if (isGuest) ...[
            const _SectionHeader(title: 'Login'),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  _CardSettingsRow(
                    iconPath: "assets/icon/link.svg",
                    iconColor: const Color(0xFF4C4EDB),
                    label: 'Microsoft Login',
                    onTap: _linkMicrosoftAccount,
                    roundTop: true,
                    roundBottom: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // ── Logout ──────────────────────────────────────────────
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
  final String hostelName;
  final VoidCallback onTap;

  const _AccountProfileCard({
    required this.name,
    required this.hostel,
    required this.hostelName,
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
                            fontSize: 24,
                            fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hostelName.isNotEmpty
                            ? hostelName
                            : (hostel.isEmpty ? '—' : calculateHostel(hostel)),
                        style: TextStyle(
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
// Card settings row
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
    this.subtitle,
    required this.onTap,
    this.roundTop = true,
    this.roundBottom = true,
  });

  @override
  Widget build(BuildContext context) {
    const r = Radius.circular(12);
    const z = Radius.zero;
    final borderRadius = BorderRadius.only(
      topLeft: roundTop ? r : z,
      topRight: roundTop ? r : z,
      bottomLeft: roundBottom ? r : z,
      bottomRight: roundBottom ? r : z,
    );

    return Container(
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: borderRadius,
          border: Border.all(color: const Color(0xFFE5E5E5), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 4),
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
                  colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
                ),
              ),
              title: Text(label,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500)),
              subtitle: subtitle != null
                  ? Text(subtitle!,
                      style: const TextStyle( fontSize: 14))
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
