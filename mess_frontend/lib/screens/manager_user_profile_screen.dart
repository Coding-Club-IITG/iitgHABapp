import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../providers/auth_controller.dart';
import '../utils/name_case.dart';

class ManagerUserProfileScreen extends StatefulWidget {
  const ManagerUserProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  State<ManagerUserProfileScreen> createState() =>
      _ManagerUserProfileScreenState();
}

class _ManagerProfileData {
  final Map<String, dynamic> profile;
  final Uint8List? pictureBytes;

  _ManagerProfileData({
    required this.profile,
    required this.pictureBytes,
  });
}

class _ManagerUserProfileScreenState extends State<ManagerUserProfileScreen> {
  late Future<_ManagerProfileData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ManagerProfileData> _load() async {
    final token = context.read<AuthController>().token;
    if (token == null) {
      throw StateError('Not signed in');
    }
    final profile = await ManagerApi.fetchUserProfileForManager(
      token: token,
      userId: widget.userId,
    );
    final picture = await ManagerApi.fetchUserProfilePictureForManager(
      token: token,
      userId: widget.userId,
    );
    return _ManagerProfileData(profile: profile, pictureBytes: picture);
  }

  Future<void> _retry() async {
    setState(() {
      _future = _load();
    });
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
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
        ),
        centerTitle: false,
      ),
      body: FutureBuilder<_ManagerProfileData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Failed to load profile.\n${snapshot.error}',
                      style: const TextStyle(
                        color: Color(0xFFB91C1C),
                        fontSize: 14,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    TextButton.icon(
                      onPressed: _retry,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final data = snapshot.data!;
          final profile = data.profile;
          final bytes = data.pictureBytes;

          final rawName = (profile['name'] ?? 'Unknown') as String;
          final name = toTitleCase(rawName);
          final roll = (profile['rollNumber'] ?? '') as String;
          final hostel = (profile['hostelName'] ?? '') as String;
          final mess = (profile['messName'] ?? '') as String;

          final initial = name.isNotEmpty ? name.trim()[0].toUpperCase() : '?';
          final hasImage = bytes != null && bytes.isNotEmpty;

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 68,
                  backgroundColor: Colors.grey.shade200,
                  backgroundImage: hasImage ? MemoryImage(bytes) : null,
                  child: !hasImage
                      ? Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.black,
                            fontSize: 28,
                            fontWeight: FontWeight.w600,
                          ),
                        )
                      : null,
                ),
                const SizedBox(height: 32),
                _ProfileField(
                  icon: Icons.person_outline,
                  label: 'Name',
                  value: name.isEmpty ? '—' : name,
                ),
                const Divider(height: 16, color: Color(0xFFE2E2E2)),
                _ProfileField(
                  icon: Icons.restaurant_outlined,
                  label: 'Current Mess',
                  value: mess.isEmpty ? '—' : mess,
                ),
                const Divider(height: 16, color: Color(0xFFE2E2E2)),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _ProfileField(
                        icon: Icons.home_outlined,
                        label: 'Hostel',
                        value: hostel.isEmpty ? '—' : hostel,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 48,
                      color: const Color(0xFFE2E2E2),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 16),
                        child: _ProfileField(
                          icon: null,
                          label: 'Roll No.',
                          value: roll.isEmpty ? '—' : roll,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileField extends StatelessWidget {
  final IconData? icon;
  final String label;
  final String value;

  const _ProfileField({
    required this.icon,
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
          if (icon != null) ...[
            Icon(icon, size: 24, color: const Color(0xFF111827)),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[800],
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    color: Colors.black,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
