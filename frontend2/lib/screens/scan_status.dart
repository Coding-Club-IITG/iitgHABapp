import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ScanStatusPage extends StatefulWidget {
  final Response response;
  const ScanStatusPage({
    super.key,
    required this.response,
  });

  @override
  State<ScanStatusPage> createState() => _ScanStatusPageState();
}

class _ScanStatusPageState extends State<ScanStatusPage> {
  String profilePicture = '';

  @override
  void initState() {
    super.initState();
    _loadProfilePicture();
  }

  Future<void> _loadProfilePicture() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      profilePicture = prefs.getString("profilePicture") ?? "";
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _buildStatusContent(context),
      ),
    );
  }

  Widget _buildStatusContent(BuildContext context) {
    final statusCode = widget.response.statusCode ?? 500;
    final data = widget.response.data as Map<String, dynamic>? ?? {};

    if (kDebugMode) debugPrint(data['message']?.toString());
    if (kDebugMode) debugPrint(statusCode.toString());

    final bool success = data['success'] == true;
    if (statusCode == 200 && success) {
      return _buildSuccessScreen(context, data);
    } else if (statusCode == 200 &&
        data['message']?.toString().contains('Already') == true) {
      return _buildAlreadyLoggedScreen(context, data);
    } else {
      return _buildFailedScreen(context, data);
    }
  }

  Widget _buildSuccessScreen(BuildContext context, Map<String, dynamic> data) {
  final mealType = data['mealType'] ?? 'Meal';
  final userName = data['user']?['name'] ?? 'User';
  final time = data['time'] ?? _getCurrentTime();
  final date = data['date'] ?? _getCurrentDate();

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
                      '$time,\n$date',
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 10),

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
Widget _buildFailedScreen(BuildContext context, Map<String, dynamic> data) {
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
                data['message']?.toString() ?? 'Something went wrong',
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

Widget _buildAlreadyLoggedScreen(
    BuildContext context, Map<String, dynamic> data) {
  final message = data['message']?.toString() ?? 'Entry Already Logged!';
  final mealType = _extractMealType(message);
  final time = data['time'] ?? _getCurrentTime();

  return Container(
    color: Colors.white,
    child: Column(
      children: [
        const SizedBox(height: 120),

        Image.asset(
          'assets/images/alert.png',
          width: 120,
          height: 120,
        ),

        const SizedBox(height: 20),

        // ✅ Title
        const Text(
          'Entry Already Logged!',
          style: TextStyle(
            color: Color(0xFFB26A00),
            fontSize: 22,
            fontWeight: FontWeight.w500,
          ),
        ),

        const Spacer(),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SizedBox(
            width: double.infinity, // ✅ THIS is the key fix
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 20),
              decoration: BoxDecoration(
                color: const Color(0xFFF3E3C8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Text(
                    'You have already entered at',
                    style: const TextStyle(
                      color: Color(0xFF8A5A00),
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    time,
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),

        // ✅ Bottom Grey Panel
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 30),
          decoration: const BoxDecoration(
            color: Color(0xFFF1F1F1),
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          child: SizedBox(
            width: double.infinity,
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
                backgroundColor: const Color(0xFF5B5FEF),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Go Home',
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
  );
}

  String _extractMealType(String message) {
    if (message.toLowerCase().contains('breakfast')) return 'Breakfast';
    if (message.toLowerCase().contains('lunch')) return 'Lunch';
    if (message.toLowerCase().contains('dinner')) return 'Dinner';
    return 'Meal';
  }

  String _getCurrentTime() {
    final now = DateTime.now();
    final hour =
        now.hour > 12 ? now.hour - 12 : (now.hour == 0 ? 12 : now.hour);
    final minute = now.minute.toString().padLeft(2, '0');
    final period = now.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  String _getCurrentDate() {
    final now = DateTime.now();
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${now.day} ${months[now.month - 1]} ${now.year}';
  }
}

// Custom painter for triangle shape
class TrianglePainter extends CustomPainter {
  final Color color;

  TrianglePainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(size.width / 2, 0); // Top point
    path.lineTo(0, size.height); // Bottom left
    path.lineTo(size.width, size.height); // Bottom right
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
