import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/apis/authentication/login.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';
import 'package:frontend2/widgets/login screen/login_button.dart';
import 'package:lottie/lottie.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        primaryColor: const Color(0xFF0D1D40),
        scaffoldBackgroundColor: const Color(0xFF0D1D40),
      ),
      child: const OnboardingScreen(),
    );
  }
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

/// Get user-friendly error message based on error type
String _getErrorMessage(dynamic error) {
  if (error is DioException) {
    // Check for timeout errors
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return 'Connection timeout. Your internet connection seems slow. Please check your connection and try again.';
    }
    // Check for connection errors
    if (error.type == DioExceptionType.connectionError) {
      return 'Connection failed. Please check your internet connection and try again.';
    }
    // Check for other Dio errors
    if (error.message != null && error.message!.contains('timeout')) {
      return 'Request timeout. Please check your internet connection and try again.';
    }
  }
  // Default error message
  return 'Something went wrong. Please try again.';
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  bool _inprogress = false;

  void _showBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Stack(
              children: [
                FractionallySizedBox(
                  heightFactor: 0.4, // slightly increased height
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(24),
                        topRight: Radius.circular(24),
                      ),
                    ),
                    child: Padding(
                      padding: EdgeInsets.only(
                        left: 24,
                        right: 24,
                        top: 24,
                        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                      ),
                      child: SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Sign in',
                              style: TextStyle(
                                fontFamily: 'GeneralSans',
                                fontWeight: FontWeight.w600,
                                fontSize: 32,
                              ),
                            ),
                            const Divider(),
                            const Text(
                              'For Students',
                              style: TextStyle(
                                fontFamily: 'GeneralSans',
                                fontWeight: FontWeight.w500,
                                fontSize: 14,
                                color: Color(0xFF676767),
                              ),
                            ),
                            const SizedBox(height: 10),

                            // Apple Sign In button - Only visible on iOS
                            if (!kIsWeb && Platform.isIOS)
                              SizedBox(
                                height: 48,
                                width: double.infinity,
                                child: Material(
                                  color: Colors.black,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(50),
                                  ),
                                  child: InkWell(
                                    splashColor: Colors.white24,
                                    onTap: () async {
                                      final navigator = Navigator.of(context);
                                      final messenger =
                                          ScaffoldMessenger.of(context);
                                      try {
                                        setModalState(() {
                                          _inprogress = true;
                                        });
                                        await signInWithApple();
                                        setModalState(() {
                                          _inprogress = false;
                                        });
                                        if (!mounted) return;
                                        navigator.pushAndRemoveUntil(
                                          MaterialPageRoute(
                                            builder: (context) =>
                                                const MainNavigationScreen(),
                                          ),
                                          (route) => false,
                                        );
                                        messenger.showSnackBar(
                                          const SnackBar(
                                            content: Center(
                                              child: Text(
                                                'Successfully Logged In',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                    color: Colors.white),
                                              ),
                                            ),
                                            backgroundColor: Colors.black,
                                            behavior: SnackBarBehavior.floating,
                                            margin: EdgeInsets.all(50),
                                            duration:
                                                Duration(milliseconds: 1000),
                                          ),
                                        );
                                      } catch (e) {
                                        setModalState(() {
                                          _inprogress = false;
                                        });
                                        final errorMessage =
                                            _getErrorMessage(e);
                                        messenger.showSnackBar(
                                          SnackBar(
                                            content: Center(
                                              child: Text(
                                                errorMessage,
                                                textAlign: TextAlign.center,
                                                style: const TextStyle(
                                                    color: Colors.white),
                                              ),
                                            ),
                                            backgroundColor: Colors.black,
                                            behavior: SnackBarBehavior.floating,
                                            margin: const EdgeInsets.all(50),
                                            duration: const Duration(
                                                milliseconds: 3000),
                                          ),
                                        );
                                      }
                                    },
                                    child: const Padding(
                                      padding: EdgeInsets.all(15),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.apple,
                                              color: Colors.white, size: 20),
                                          SizedBox(width: 8),
                                          Text(
                                            'Sign in with Apple',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w500,
                                              fontSize: 14,
                                              fontFamily: 'GeneralSans',
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                            if (!kIsWeb && Platform.isIOS)
                              const SizedBox(height: 10),

                            // Microsoft login (Link Student Account)
                            SizedBox(
                              height: 48,
                              width: double.infinity,
                              child: Material(
                                color: const Color(0xFF4C4EDB),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: InkWell(
                                  splashColor: Colors.white,
                                  onTap: () async {
                                    final navigator = Navigator.of(context);
                                    final messenger =
                                        ScaffoldMessenger.of(context);
                                    try {
                                      setModalState(() {
                                        _inprogress = true;
                                      });
                                      await authenticate();
                                      setModalState(() {
                                        _inprogress = false;
                                      });
                                      if (!mounted) return;
                                      navigator.pushAndRemoveUntil(
                                        MaterialPageRoute(
                                          builder: (context) =>
                                              const MainNavigationScreen(),
                                        ),
                                        (route) => false,
                                      );
                                      messenger.showSnackBar(
                                        const SnackBar(
                                          content: Center(
                                            child: Text(
                                              'Successfully Logged In',
                                              textAlign: TextAlign.center,
                                              style: TextStyle(
                                                  color: Colors.white),
                                            ),
                                          ),
                                          backgroundColor: Colors.black,
                                          behavior: SnackBarBehavior.floating,
                                          margin: EdgeInsets.all(50),
                                          duration:
                                              Duration(milliseconds: 1000),
                                        ),
                                      );
                                    } catch (e) {
                                      setModalState(() {
                                        _inprogress = false;
                                      });
                                      final errorMessage = _getErrorMessage(e);
                                      messenger.showSnackBar(
                                        SnackBar(
                                          content: Center(
                                            child: Text(
                                              errorMessage,
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                  color: Colors.white),
                                            ),
                                          ),
                                          backgroundColor: Colors.black,
                                          behavior: SnackBarBehavior.floating,
                                          margin: const EdgeInsets.all(50),
                                          duration: const Duration(
                                              milliseconds: 3000),
                                        ),
                                      );
                                    }
                                  },
                                  child: const Padding(
                                    padding: EdgeInsets.all(15),
                                    child: LoginButton(),
                                  ),
                                ),
                              ),
                            ),

                            const SizedBox(height: 10),

                            // Guest login
                            SizedBox(
                              height: 48,
                              width: double.infinity,
                              child: Material(
                                color: const Color(0xFF2E2E2E),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: InkWell(
                                  splashColor: Colors.white24,
                                  onTap: () async {
                                    final navigator = Navigator.of(context);
                                    final messenger =
                                        ScaffoldMessenger.of(context);
                                    try {
                                      setModalState(() {
                                        _inprogress = true;
                                      });
                                      await guestAuthenticate();
                                      setModalState(() {
                                        _inprogress = false;
                                      });
                                      if (!mounted) return;
                                      navigator.pushAndRemoveUntil(
                                        MaterialPageRoute(
                                          builder: (context) =>
                                              const MainNavigationScreen(),
                                        ),
                                        (route) => false,
                                      );
                                      messenger.showSnackBar(
                                        const SnackBar(
                                          content: Center(
                                            child: Text(
                                              'Successfully Logged In as Guest',
                                              textAlign: TextAlign.center,
                                              style: TextStyle(
                                                  color: Colors.white),
                                            ),
                                          ),
                                          backgroundColor: Colors.black,
                                          behavior: SnackBarBehavior.floating,
                                          margin: EdgeInsets.all(50),
                                          duration:
                                              Duration(milliseconds: 1000),
                                        ),
                                      );
                                    } catch (e) {
                                      setModalState(() {
                                        _inprogress = false;
                                      });
                                      final errorMessage =
                                          _getErrorMessage(e);
                                      messenger.showSnackBar(
                                        SnackBar(
                                          content: Center(
                                            child: Text(
                                              errorMessage,
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                  color: Colors.white),
                                            ),
                                          ),
                                          backgroundColor: Colors.black,
                                          behavior: SnackBarBehavior.floating,
                                          margin: const EdgeInsets.all(50),
                                          duration: const Duration(
                                              milliseconds: 3000),
                                        ),
                                      );
                                    }
                                  },
                                  child: const Padding(
                                    padding: EdgeInsets.all(12),
                                    child: Center(
                                      child: Text(
                                        'Sign in as Guest',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w500,
                                          fontSize: 14,
                                          fontFamily: 'GeneralSans',
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // Lottie loader overlay
                if (_inprogress)
                  Positioned.fill(
                    child: AbsorbPointer(
                      absorbing: true,
                      child: Container(
                        color: const Color.fromRGBO(0, 0, 0, 0.7),
                        child: Center(
                          child: Lottie.asset(
                            'assets/lottie/loader.json',
                            width: 240,
                            height: 240,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.height < 700;

    return Scaffold(
      body: Container(
        color: const Color(0xFF0D1D40),
        child: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                top: MediaQuery.of(context).size.height * 0.3,
                child: Image.asset(
                  'assets/images/Phone.png',
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(height: isSmallScreen ? 20.0 : 40.0),
                    Center(
                      child: SizedBox(
                        width: screenSize.width * 0.9,
                        height: isSmallScreen ? 120.0 : 152.0,
                        child: const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Welcome to',
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'HABit',
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFAFB9D2),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    SizedBox(height: isSmallScreen ? 24.0 : 48.0),
                    Expanded(
                      flex: 3,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final double scaleFactor =
                              constraints.maxHeight / 240.0;
                          return Stack(
                            fit: StackFit.expand,
                            children: [
                              Positioned(
                                left: 20 * scaleFactor,
                                top: 20 * scaleFactor,
                                child: const FeatureButton(
                                  text: 'Feedbacks',
                                  color: Color(0xFF1F7157),
                                  imagePath:
                                      'assets/images/features/feedback.png',
                                ),
                              ),
                              Positioned(
                                right: 20 * scaleFactor,
                                top: 20 * scaleFactor,
                                child: const FeatureButton(
                                  text: 'Canteens',
                                  color: Color(0xFF4E46B4),
                                  imagePath:
                                      'assets/images/features/canteens.png',
                                ),
                              ),
                              Positioned(
                                left: 50 * scaleFactor,
                                top: 90 * scaleFactor,
                                child: const FeatureButton(
                                  text: 'Mess',
                                  color: Color(0xFF4E46B4),
                                  imagePath: 'assets/images/features/mess.png',
                                ),
                              ),
                              Positioned(
                                left: 40 * scaleFactor,
                                top: 160 * scaleFactor,
                                child: const FeatureButton(
                                  text: 'Updates',
                                  color: Color(0xFFB27C38),
                                  imagePath:
                                      'assets/images/features/updates.png',
                                ),
                              ),
                              Positioned(
                                right: 40 * scaleFactor,
                                top: 160 * scaleFactor,
                                child: const FeatureButton(
                                  text: 'Schedules',
                                  color: Color(0xFF1F7157),
                                  imagePath:
                                      'assets/images/features/schedules.png',
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                    const Expanded(
                      flex: 1,
                      child: SingleChildScrollView(
                        child: Column(
                          children: [
                            Text(
                              'A space built around your hostel life.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'From mess feedback to schedules and updates, everything you need is now just a tap away.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    SafeArea(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 16.0),
                        child: ElevatedButton(
                          onPressed: () => _showBottomSheet(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF6149CD),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30.0),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 16.0),
                          ),
                          child: const Text(
                            'Get Started',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
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
        ),
      ),
    );
  }
}

class FeatureButton extends StatelessWidget {
  final String text;
  final Color color;
  final String imagePath;

  const FeatureButton({
    super.key,
    required this.text,
    required this.color,
    required this.imagePath,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.3),
            blurRadius: 6,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

