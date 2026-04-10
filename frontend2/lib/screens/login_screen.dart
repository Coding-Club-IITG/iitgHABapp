import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_svg/flutter_svg.dart';
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

class _OnboardingScreenState extends State<OnboardingScreen> with SingleTickerProviderStateMixin {
  bool _inprogress = false;

  late AnimationController _controller;
  late Animation<double> _curvedAnimation;
  late Animation<double> _expand_animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );

    _curvedAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.decelerate, // This makes it start fast and slow down smoothly
      reverseCurve: Curves.easeIn, // Optional: different curve for the reverse direction
    );

    // Define the range of the value
    _expand_animation = Tween<double>(begin: 0, end: 1).animate(_curvedAnimation);
  }

  void _showLoader(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false, // Prevents user from tapping outside to close
      barrierColor: const Color.fromRGBO(0, 0, 0, 0.7), // Your dark overlay
      builder: (BuildContext context) {
        return PopScope(
          canPop: false, // Prevents back button from closing the loader
          child: Center(
            child: Lottie.asset(
              'assets/lottie/loader.json',
              width: 240,
              height: 240,
              fit: BoxFit.contain,
            ),
          ),
        );
      },
    );
  }

  void _showBottomSheet(BuildContext context) {
    _controller.forward();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withAlpha(40),
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Stack(
              children: [
                FractionallySizedBox(
                  heightFactor: 0.4125 + ((!kIsWeb && Platform.isIOS) ? 0.05 : 0.0), // slightly increased height
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(16),
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
                            const Divider(height: 32, thickness: 1.6,),
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
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: InkWell(
                                    splashColor: Colors.white24,
                                    onTap: () async {
                                      _showLoader(context);
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
                                        navigator.pop();
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
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: InkWell(
                                  splashColor: Colors.white,
                                  onTap: () async {
                                    _showLoader(context);
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
                                      navigator.pop();
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

                            const Row(
                              children: [
                                Expanded(child: Divider(height: 32, thickness: 1.6,)),
                                Padding(
                                  padding: EdgeInsets.all(8.0),
                                  child: Text(
                                      'OR',
                                      style: TextStyle(
                                          color: const Color(0xFFB9B9F4) /* Brand-Primary-Border-1 */,
                                          fontSize: 14,
                                          fontFamily: 'General Sans Variable',
                                          fontWeight: FontWeight.w500,
                                          height: 1.43,
                                      ),
                                  ),
                                ),
                                Expanded(child: Divider(height: 32, thickness: 2,)),
                              ],
                            ),

                            // Guest login
                            SizedBox(
                              height: 48,
                              width: double.infinity,
                              child: Material(
                                // color: const Color(0xFF2E2E2E),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: const BorderSide(
                                    width: 1,
                                    color: Color(0xFFB9B9F4) /* Brand-Primary-Border-1 */,
                                  ),
                                ),
                                child: InkWell(
                                  splashColor: Colors.white24,
                                  onTap: () async {
                                    _showLoader(context);
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
                                      navigator.pop();
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
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    spacing: 12,
                                    children: [
                                      SvgPicture.asset("assets/icon/emoji_people.svg", width: 24, height: 24,),
                                      const Text(
                                        'Guest Sign In',
                                        style: TextStyle(
                                        color: Color(0xFF4B4EDA) /* Brand-Primary */,
                                        fontSize: 14,
                                        fontFamily: 'General Sans Variable',
                                        fontWeight: FontWeight.w500,
                                        height: 1.43,
                                      ),
                                      ),
                                    ],
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
                // if (_inprogress)
                //   Positioned.fill(
                //     child: AbsorbPointer(
                //       absorbing: true,
                //       child: Container(
                //         color: const Color.fromRGBO(0, 0, 0, 0.7),
                //         child: Center(
                //           child: Lottie.asset(
                //             'assets/lottie/loader.json',
                //             width: 240,
                //             height: 240,
                //             fit: BoxFit.contain,
                //           ),
                //         ),
                //       ),
                //     ),
                //   ),
              ],
            );
          },
        );
      },
    ).then((_) {
      if (mounted) {
        _controller.reverse();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.height < 700;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [Color(0xFFCBC1EC), Color(0xFFFFFFFF)], begin: AlignmentGeometry.topCenter, end: AlignmentGeometry.bottomCenter)
        ),
        child: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                // top: MediaQuery.of(context).size.height ,
                child: Image.asset(
                  'assets/images/Phone.png',
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 0.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(height: isSmallScreen ? 20.0 : 40.0),
                    Center(
                      child: SizedBox(
                        width: screenSize.width * 0.9,
                        height: isSmallScreen ? 120.0 : 152.0,
                        child: Center(
                          child: SvgPicture.asset("assets/images/Habit_logo_Purple_colored.svg")
                        ),
                      ),
                    ),
                    AnimatedBuilder(
                      animation: _expand_animation,
                      builder: (context, child) => Expanded(
                        flex: 4,
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final double scaleFactor =
                                constraints.maxHeight / 240.0;
                            return Stack(
                              fit: StackFit.loose,
                              children: [
                                Positioned(
                                  left: (40 + 10 * _expand_animation.value) * scaleFactor,
                                  top: (40 - 5 * _expand_animation.value) * scaleFactor,
                                  child: Image.asset(
                                        'assets/icon/LoginIcon4.png',
                                        width: 49,
                                        height: 49,
                                  )
                                ),
                                Positioned(
                                  right: (40 + 10 * _expand_animation.value) * scaleFactor,
                                  top: (50 - 20 * _expand_animation.value) * scaleFactor,
                                  child: Image.asset(
                                        'assets/icon/LoginIcon2.png',
                                        width: 49,
                                        height: 49,
                                  )
                                ),
                                Positioned(
                                  left: (10 + 10 * _expand_animation.value) * scaleFactor,
                                  top: (130 - 30 * _expand_animation.value) * scaleFactor,
                                  child: Image.asset(
                                        'assets/icon/LoginIcon3.png',
                                        width: 49,
                                        height: 49,
                                  )
                                ),
                                Positioned(
                                  right: (0 + 10 * _expand_animation.value) * scaleFactor,
                                  top: (140 - 40 * _expand_animation.value) * scaleFactor,
                                  child: Image.asset(
                                        'assets/icon/LoginIcon1.png',
                                        width: 49,
                                        height: 49,
                                  )
                                ),
                                Positioned(
                                  left: 0,
                                  right: 0,
                                  top: 0 * scaleFactor,
                                  child: Image.asset(
                                        'assets/icon/LoginIcon5.png',
                                        width: 49,
                                        height: 49,
                                  )
                                ),
                                // Positioned(
                                //   left: 40 * scaleFactor,
                                //   top: 160 * scaleFactor,
                                //   child: const FeatureButton(
                                //     text: 'Updates',
                                //     color: Color(0xFFB27C38),
                                //     imagePath:
                                //         'assets/icon/LoginIcon4.png',
                                //   ),
                                // ),
                                // Positioned(
                                //   right: 40 * scaleFactor,
                                //   top: 160 * scaleFactor,
                                //   child: const FeatureButton(
                                //     text: 'Schedules',
                                //     color: Color(0xFF1F7157),
                                //     imagePath:
                                //         'assets/icon/LoginIcon5.png',
                                //   ),
                                // ),
                                Positioned(
                                  right: 0,
                                  left: 0,
                                  top: (120 - 45 * _expand_animation.value) * scaleFactor,
                                  child: Text(
                                    'A space built\naround your\nhostel life',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: const Color(0xFF2E2F31),
                                      fontSize: 28 * scaleFactor,
                                      fontFamily: "GeneralSans",
                                      fontWeight: FontWeight.w500
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                    Text(
                      'From mess feedback to shared\ncomplaints everything you need\nis now just a tap away.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color.lerp(
                          const Color(0xFF2E2F31), // Original dark color
                          const Color(0xFF535353), // Target grey color
                          _expand_animation.value,  // The interpolation factor
                        ),
                        fontSize: 12,
                        fontFamily: "GeneralSans",
                        fontWeight: FontWeight.w500
                      ),
                    ),
                    const Spacer(),
                    const Spacer(),
                    SafeArea(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 60.0),
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Center(
                          child: Container(
                            width: 220,
                            child: ElevatedButton(
                              onPressed: () => _showBottomSheet(context),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF6149CD),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
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

