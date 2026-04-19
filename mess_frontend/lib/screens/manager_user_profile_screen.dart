import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../providers/auth_controller.dart';

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
        title: const Text(
          'Profile',
          style: TextStyle(
            color: Color(0xFF111827),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
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

          final name = (profile['name'] ?? 'Unknown') as String;
          final roll = (profile['rollNumber'] ?? '') as String;
          final hostel = (profile['hostelName'] ?? '') as String;
          final mess = (profile['messName'] ?? '') as String;

          final initial = name.isNotEmpty ? name.trim()[0].toUpperCase() : '?';
          final hasImage = bytes != null && bytes.isNotEmpty;

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CircleAvatar(
                  radius: 100,
                  backgroundColor: const Color(0xFFE5E7EB),
                  backgroundImage: hasImage ? MemoryImage(bytes) : null,
                  child: !hasImage
                      ? Text(
                          initial,
                          style: const TextStyle(
                            color: Color(0xFF111827),
                            fontSize: 32,
                            fontWeight: FontWeight.w600,
                          ),
                        )
                      : null,
                ),
                const SizedBox(height: 12),
                Text(
                  name,
                  style: const TextStyle(
                    color: Color(0xFF111827),
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 24),
                _ProfileFieldRow(
                  icon: Icons.badge_outlined,
                  label: 'Roll Number',
                  value: roll,
                ),
                _ProfileFieldRow(
                  icon: Icons.restaurant_outlined,
                  label: 'Current Mess',
                  value: mess,
                ),
                _ProfileFieldRow(
                  icon: Icons.home_outlined,
                  label: 'Hostel',
                  value: hostel,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileFieldRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ProfileFieldRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 20,
            color: const Color(0xFF6B7280),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value.isEmpty ? '-' : value,
                  style: const TextStyle(
                    color: Color(0xFF111827),
                    fontSize: 14,
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
