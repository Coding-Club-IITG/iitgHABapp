// ─────────────────────────────────────────────────────────────────────────────
// Profile detail sub-screen
// ─────────────────────────────────────────────────────────────────────────────

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/initial_setup_screen.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';

class ProfileScreen extends StatelessWidget {
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

  const ProfileScreen({
    super.key,
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
              fontFamily: Themes.kFont,
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
                    fontFamily: Themes.kFont,
                    color: Themes.kAccent,
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
                    const CircularProgressIndicator(color: Themes.kAccent),
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
            const Divider(),

            _ProfileField(
              iconPath: 'assets/icon/messicon.svg',
              label: 'Current Mess',
              value: currMess.isEmpty ? '—' : calculateHostel(currMess),
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
            const Divider(height: 16, color: Color(0xFFE2E2E2)),

            _ProfileField(
              iconPath: 'assets/icon/rollno.svg',
              label: 'Roll No.',
              value: rollNo.isEmpty ? '—' : rollNo,
            ),
            const Divider(height: 16, color: Color(0xFFE2E2E2)),

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
