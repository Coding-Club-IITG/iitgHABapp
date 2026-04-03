import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/apis/users/user.dart';

class ProfilePictureProvider {
  static var profilePictureString = ValueNotifier<String>("");
  static var isSetupDone = ValueNotifier<bool>(false);
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    // Do NOT overwrite existing stored picture
    profilePictureString.value = prefs.getString("profilePicture") ?? "";

    // Check if user is a guest user (has guestIdentifier and Microsoft not linked)
    final guestIdentifier = prefs.getString('guestIdentifier');
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
    final isGuest = guestIdentifier != null && !hasMicrosoftLinked;

    // Guest users skip the setup screen - automatically mark setup as done
    if (isGuest) {
      isSetupDone.value = true;
      prefs.setBool("isSetupDone", true);
    } else {
      // Read persisted setup flag for non-guest users
      isSetupDone.value = prefs.getBool("isSetupDone") ?? false;
    }
  }
}

class InitialSetupScreen extends StatefulWidget {
  const InitialSetupScreen({super.key});

  @override
  State<InitialSetupScreen> createState() => _InitialSetupScreenState();
}

class _InitialSetupScreenState extends State<InitialSetupScreen> {
  String email = '';
  String hostel = '';
  String currMess = '';
  String hostelName = '';
  String currMessName = '';
  bool hasMicrosoftLinked = false;
  final TextEditingController _roomController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  bool _saving = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final prefs = await SharedPreferences.getInstance();
    final h = prefs.getString('hostel') ?? '';
    final m = prefs.getString('currMess') ?? '';

    setState(() {
      email = prefs.getString('email') ?? '';
      hostel = h;
      currMess = m;
      hostelName = h.isEmpty ? '-' : calculateHostel(h);
      currMessName = m.isEmpty ? '-' : calculateHostel(m);
      hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
      _roomController.text = prefs.getString('roomNumber') ?? '';
      _phoneController.text = prefs.getString('phoneNumber') ?? '';
    });
  }

  Future<void> _pickAndSetProfileImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? pfp = await picker.pickImage(source: ImageSource.gallery);
    if (pfp == null) return;

    final finalPath = '${(await getTemporaryDirectory()).path}/${pfp.name}';
    await FlutterImageCompress.compressAndGetFile(
      pfp.path,
      finalPath,
      minWidth: 256,
      minHeight: 256,
      quality: 85,
    );

    final imageB64 = base64Encode(File(finalPath).readAsBytesSync());
    // Update in-memory preview only. Do not persist until upload succeeds.
    ProfilePictureProvider.profilePictureString.value = imageB64;
    setState(() {});

    await _uploadProfileImage(File(finalPath), pfp.name, imageB64);
  }

  Future<void> _uploadProfileImage(
      File file, String filename, String imageB64) async {
    if (_uploading) return;
    setState(() => _uploading = true);
    try {
      final token = await getAccessToken();
      // If the widget was disposed while awaiting, bail out
      if (!mounted) return;
      if (token == 'error') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Not authenticated. Please login again.')),
        );
        return;
      }

      final dio = DioClient().dio;
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: filename,
        ),
      });

      final res = await dio.post(
        ProfilePicture.changeUserProfilePicture,
        data: formData,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      if (res.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        // Persist only after successful upload. Do not store remote URL in prefs.
        await prefs.setString('profilePicture', imageB64);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile picture uploaded')),
        );
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed (${res.statusCode})')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload error: $e')),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _handleSave() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final newRoom = _roomController.text.trim();
      final newPhone = _phoneController.text.trim();

      // First, update server with authenticated user
      final success = await saveUserProfileFields(
          roomNumber: newRoom.isEmpty ? null : newRoom,
          phoneNumber: newPhone.isEmpty ? null : newPhone);

      if (!success) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save profile on server')),
        );
        return;
      }

      // Then mark setup complete on backend (existing behaviour)
      final token = await getAccessToken();
      if (token != 'error') {
        final dio = DioClient().dio;
        try {
          await dio.post(
            '$baseUrl/profile/setup/complete',
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );
        } catch (_) {
          // ignore; we still persist local copy
        }
      }

      // Persist locally after backend success
      await prefs.setString('roomNumber', newRoom);
      await prefs.setString('phoneNumber', newPhone);
      await prefs.setBool('isSetupDone', true);
      ProfilePictureProvider.isSetupDone.value = true;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _handleSkip() async {
    // Do not persist; allow proceeding just for this session
    ProfilePictureProvider.isSetupDone.value = true;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.grey[50],
        title: const Text(
          "Additional Information",
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        child: Container(
          width: double.infinity,
          color: Colors.white,
          margin: const EdgeInsets.only(top: 8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: ValueListenableBuilder(
                    valueListenable:
                        ProfilePictureProvider.profilePictureString,
                    builder: (context, value, child) => CircleAvatar(
                      radius: 64,
                      // show local default when no profile pic present
                      backgroundColor: Colors.transparent,
                      backgroundImage: value.isNotEmpty
                          ? MemoryImage(base64Decode(value))
                          : const AssetImage(
                                  'assets/images/default_profile.png')
                              as ImageProvider,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: _uploading ? null : _pickAndSetProfileImage,
                  child: Text(
                      _uploading ? "Uploading..." : "Change Profile Picture"),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Your details',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                // Only show email field if Microsoft is linked OR if email exists (from Apple)
                // This ensures we don't show empty email field for Apple-only users, complying with App Store Guideline 4.0
                if (hasMicrosoftLinked || email.isNotEmpty) ...[
                  _readonlyTile(Icons.email_outlined, 'Email', email),
                  const Divider(height: 24, color: Color(0xFFE2E2E2)),
                ],
                _readonlyTile(Icons.home_outlined, 'Hostel', hostelName),
                const Divider(height: 24, color: Color(0xFFE2E2E2)),
                _readonlyTile(Icons.restaurant_menu_outlined, 'Current Mess',
                    currMessName),
                const Divider(height: 24, color: Color(0xFFE2E2E2)),
                // Info: other fields are read-only
                const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 16, color: Colors.grey),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'The above details cannot be modified. Please contact the HAB Admin if you want to change them.',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Additional info',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                _editableField(
                  controller: _roomController,
                  label: 'Room Number',
                  icon: Icons.meeting_room_outlined,
                  keyboardType: TextInputType.text,
                ),
                const SizedBox(height: 16),
                _editableField(
                  controller: _phoneController,
                  label: 'Phone Number',
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _handleSkip,
                        child: const Text('Skip for now'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _saving ? null : _handleSave,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6149CD),
                        ),
                        child: Text(
                          _saving ? 'Saving...' : 'Save',
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _readonlyTile(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon, color: Colors.grey[600], size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              const SizedBox(height: 4),
              Text(
                value.isEmpty ? '-' : value,
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey[700]),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _editableField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        prefixIcon: Icon(icon),
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        isDense: true,
      ),
    );
  }
}
