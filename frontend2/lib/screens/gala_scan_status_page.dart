import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
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

  return Container(
    color: const Color.fromARGB(255, 255, 255, 255),
    child: Column(
      children: [
        const SizedBox(height: 120), // 👈 moved DOWN

        // ✅ Success Icon
        Container(
          child: Image.asset(
            'assets/images/tick.png',
            width: 120,
            height: 120,
          ),
        ),

        const SizedBox(height: 20),

        const Text(
          'Scan Successful!',
          style: TextStyle(
            color: Color(0xFF1B5E20),
            fontSize: 25,
            fontWeight: FontWeight.w500,
          ),
        ),

        const Spacer(), // 👈 pushes everything below

        // ✅ CARD (moved here)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 35,
                  backgroundColor: Colors.grey[300],
                  backgroundImage: profilePicture.isNotEmpty
                      ? MemoryImage(base64Decode(profilePicture))
                      : const AssetImage('assets/images/default_profile.png')
                          as ImageProvider,
                ),

                const SizedBox(height: 10),

                Text(
                  userName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                  ),
                ),

                const SizedBox(height: 15),
                Divider(color: Colors.grey.shade300),
                const SizedBox(height: 10),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Meal', style: TextStyle(color: Colors.grey)),
                    Text(mealType,
                        style: const TextStyle(fontWeight: FontWeight.w500)),
                  ],
                ),

                const SizedBox(height: 5),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Time & Date',
                        style: TextStyle(color: Colors.grey)),
                    Text(
                      '$time',
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

// ✅ Bottom Grey Panel
Container(
  width: double.infinity,
  padding: const EdgeInsets.all(20),
  decoration: const BoxDecoration(
    color: Color(0xFFF1F1F1),
    borderRadius: BorderRadius.vertical(
      top: Radius.circular(20),
    ),
  ),
  child: SizedBox(
    width: double.infinity,
    height: 55,
    child: ElevatedButton(
      onPressed: () {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
              builder: (context) => const MainNavigationScreen()),
          (Route<dynamic> route) => false,
        );
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF5B5FEF),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: const Text(
        'Go Home',
        style: TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  ),
),
      ],
    ),
  );
}

  Widget _buildFailed(BuildContext context, Map<String, dynamic> data) {
    final message = data['message']?.toString() ?? 'Scan failed';

    return Container(
    color: const Color.fromARGB(255, 255, 255, 255),
    child: Column(
      children: [
        const SizedBox(height: 120), // 👈 moved DOWN

        // ✅ Success Icon
        Container(
          child: Image.asset(
            'assets/images/failed.png',
            width: 120,
            height: 120,
          ),
        ),

        const SizedBox(height: 20),

        const Text(
          'Scan Failed!',
          style: TextStyle(
            color: Color.fromARGB(255, 177, 12, 12),
            fontSize: 25,
            fontWeight: FontWeight.w500,
          ),
        ),

        const Spacer(),

        // ✅ Optional message (small)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SizedBox(
            width: double.infinity,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color.fromARGB(255, 248, 226, 226), // light red/pink background
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFC62828), // red text
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 10),

        // ✅ Buttons row
      
Container(
  width: double.infinity,
  padding: const EdgeInsets.all(20),
  decoration: const BoxDecoration(
    color: Color(0xFFF1F1F1),
    borderRadius: BorderRadius.vertical(
      top: Radius.circular(20),
    ),
  ),
  child: Row(
    children: [
      // Go Home
      Expanded(
        child: SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(
                    builder: (context) => const MainNavigationScreen()),
                (Route<dynamic> route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              elevation: 0,
              side: BorderSide(color: Colors.grey.shade300),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'Go Home',
              style: TextStyle(
                color: Color(0xFF5B5FEF),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),

      const SizedBox(width: 15),

      // Try Again
      Expanded(
        child: SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF5B5FEF),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'Try again',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
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
