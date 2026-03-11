import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Shows success or failure after a Gala QR scan. "Go Back" pops twice to return to Gala Dinner tab.
class GalaScanStatusPage extends StatefulWidget {
  final Response response;

  const GalaScanStatusPage({super.key, required this.response});

  @override
  State<GalaScanStatusPage> createState() => _GalaScanStatusPageState();
}

class _GalaScanStatusPageState extends State<GalaScanStatusPage> {
  String profilePicture = '';

  @override
  void initState() {
    super.initState();
    _loadProfilePicture();
  }

  Future<void> _loadProfilePicture() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      profilePicture = prefs.getString('profilePicture') ?? '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.response.data is Map
        ? Map<String, dynamic>.from(widget.response.data as Map)
        : <String, dynamic>{};
    final success = data['success'] == true;
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: success ? _buildSuccess(context, data) : _buildFailed(context, data),
      ),
    );
  }

  Widget _buildSuccess(BuildContext context, Map<String, dynamic> data) {
    final mealType = data['mealType'] ?? 'Course';
    final time = data['time'] ?? '';
    final userName = data['user']?['name'] ?? '';

    return Column(
      children: [
        const SizedBox(height: 60),
        Container(
          width: 120,
          height: 120,
          decoration: const BoxDecoration(
            color: Color.fromRGBO(76, 175, 80, 0.2),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_circle_outline_outlined,
            color: Colors.green,
            size: 80,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Scan Successful!',
          style: TextStyle(
            color: Colors.green,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 40),
        CircleAvatar(
          radius: 80,
          backgroundColor: Colors.grey[300],
          backgroundImage: profilePicture.isNotEmpty
              ? MemoryImage(base64Decode(profilePicture))
              : const AssetImage('assets/images/default_profile.png')
                  as ImageProvider,
        ),
        const SizedBox(height: 30),
        if (userName.isNotEmpty)
          Text(
            userName,
            style: const TextStyle(
              color: Color(0xFF8183F1),
              fontSize: 22,
            ),
          ),
        if (userName.isNotEmpty) const SizedBox(height: 15),
        Text(
          mealType,
          style: const TextStyle(
            color: Color(0xFF929292),
            fontSize: 22,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          time,
          style: const TextStyle(
            color: Color(0xFF8183F1),
            fontSize: 18,
          ),
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.all(30),
          child: SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                Navigator.of(context).pop();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8183F1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(25),
                ),
              ),
              child: const Text(
                'Go Back',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFailed(BuildContext context, Map<String, dynamic> data) {
    final message = data['message']?.toString() ?? 'Scan failed';

    return Column(
      children: [
        const SizedBox(height: 60),
        Container(
          width: 120,
          height: 120,
          decoration: const BoxDecoration(
            color: Color.fromRGBO(244, 67, 54, 0.2),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.error_outline_outlined,
            color: Colors.red,
            size: 80,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Scan Failed!',
          style: TextStyle(
            color: Colors.red,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            message,
            style: const TextStyle(
              color: Color(0xFF929292),
              fontSize: 18,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            children: [
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF8183F1),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: const Text(
                    'Try Again',
                    style: TextStyle(
                      color: Colors.black,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 15),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    Navigator.of(context).pop();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    side: const BorderSide(
                      color: Color(0xFF8183F1),
                      width: 2,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: const Text(
                    'Go Back',
                    style: TextStyle(
                      color: Color(0xFF8183F1),
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
