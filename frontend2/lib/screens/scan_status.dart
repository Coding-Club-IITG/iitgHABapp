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

    return Column(
      children: [
        const SizedBox(height: 60),

        // Success icon with circular background
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

        // Success message
        const Text(
          'Scan Successful!',
          style: TextStyle(
            color: Colors.green,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 40),

        // User profile picture
        CircleAvatar(
          radius: 80,
          backgroundColor: Colors.grey[300],
          backgroundImage: profilePicture.isNotEmpty
              ? MemoryImage(base64Decode(profilePicture))
              : const AssetImage('assets/images/default_profile.png')
                  as ImageProvider,
        ),

        const SizedBox(height: 30),

        // User name
        Text(
          userName,
          style: const TextStyle(
            color: Color(0xFF8183F1),
            fontSize: 22,
          ),
        ),

        const SizedBox(height: 15),

        // Meal type
        Text(
          mealType,
          style: const TextStyle(
            color: Color(0xFF929292),
            fontSize: 22,
            fontWeight: FontWeight.w600,
          ),
        ),

        const SizedBox(height: 10),

        // Time
        Text(
          time,
          style: const TextStyle(
            color: Color(0xFF8183F1),
            fontSize: 18,
          ),
        ),

        const SizedBox(height: 10),

        // Date
        Text(
          date,
          style: const TextStyle(
            color: Color(0xFF8183F1),
            fontSize: 18,
          ),
        ),

        const Spacer(),

        // Go Home button
        Padding(
          padding: const EdgeInsets.all(30),
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
                backgroundColor: const Color(0xFF8183F1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(25),
                ),
              ),
              child: const Text(
                'Go Home',
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

  Widget _buildFailedScreen(BuildContext context, Map<String, dynamic> data) {
    return Column(
      children: [
        const SizedBox(height: 60),

        // Error icon with circular background
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

        // Failed message
        const Text(
          'Scan Failed!',
          style: TextStyle(
            color: Colors.red,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 20),

        // Error details
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            data['message']?.toString() ?? 'An error occurred',
            style: const TextStyle(
              color: Color(0xFF929292),
              fontSize: 18,
            ),
            textAlign: TextAlign.center,
          ),
        ),

        const Spacer(),

        // Buttons
        Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            children: [
              // Try Again button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).pop(); // Go back to scanner
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

              // Go Home button with dark background and outline
              SizedBox(
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
                    'Go Home',
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

  Widget _buildAlreadyLoggedScreen(
      BuildContext context, Map<String, dynamic> data) {
    final message = data['message']?.toString() ?? 'Entry Already Logged!';
    final mealType = _extractMealType(message);
    final time = data['time'] ?? _getCurrentTime();

    return Column(
      children: [
        const SizedBox(height: 80),

        Container(
          width: 120,
          height: 120,
          decoration: const BoxDecoration(
            color: Color.fromRGBO(255, 152, 0, 0.2),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.warning_amber_sharp,
            color: Colors.orange,
            size: 80,
          ),
        ),

        const SizedBox(height: 20),

        // Main message
        const Text(
          'Entry Already Logged!',
          style: TextStyle(
            color: Colors.orange,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 160),

        // Meal type entry
        Text(
          '$mealType Entry at',
          style: const TextStyle(
            color: Color(0xFF929292),
            fontSize: 18,
          ),
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: 15),

        // Time in larger font with custom color
        Text(
          time,
          style: const TextStyle(
            color: Color(0xFF929292),
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),

        const Spacer(),

        // Go Home button
        Padding(
          padding: const EdgeInsets.all(30),
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
                backgroundColor: const Color(0xFF8183F1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(25),
                ),
              ),
              child: const Text(
                'Go Home',
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
