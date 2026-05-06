import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';

import '../apis/caterer_auth_api.dart';
import '../constants/themes.dart';
import '../constants/endpoint.dart';
import '../providers/auth_controller.dart';

/// HABit HQ login — same onboarding layout as HABit IITG; Google (caterer) sign-in only.
class MessManagerLoginScreen extends StatelessWidget {
  const MessManagerLoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _HqOnboardingScreen();
  }
}

String _getErrorMessage(dynamic error) {
  if (error is DioException) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return 'Connection timeout. Your internet connection seems slow. Please check your connection and try again.';
    }
    if (error.type == DioExceptionType.connectionError) {
      return 'Connection failed. Please check your internet connection and try again.';
    }
    if (error.message != null && error.message!.contains('timeout')) {
      return 'Request timeout. Please check your internet connection and try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}

class _HqOnboardingScreen extends StatefulWidget {
  const _HqOnboardingScreen();

  @override
  State<_HqOnboardingScreen> createState() => _HqOnboardingScreenState();
}

class _HqOnboardingScreenState extends State<_HqOnboardingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _curvedAnimation;
  late Animation<double> _expandAnimation;

  static const double _kSignInSheetButtonHeight = 56;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _curvedAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.decelerate,
      reverseCurve: Curves.easeIn,
    );
    _expandAnimation = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(_curvedAnimation);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _showLoader(BuildContext context) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: const Color.fromRGBO(0, 0, 0, 0.7),
      builder: (BuildContext context) {
        return PopScope(
          canPop: false,
          child: Center(
            child: SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: Themes.kAccent,
                backgroundColor: Colors.white24,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _signInSheetButton({
    Color? materialColor,
    BorderSide? outlineSide,
    required VoidCallback onTap,
    required Widget child,
  }) {
    final radius = BorderRadius.circular(14);
    final shape = outlineSide != null
        ? RoundedRectangleBorder(borderRadius: radius, side: outlineSide)
        : RoundedRectangleBorder(borderRadius: radius);

    return SizedBox(
      width: double.infinity,
      height: _kSignInSheetButtonHeight,
      child: Material(
        color: materialColor,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          splashColor: Colors.white24,
          borderRadius: radius,
          child: SizedBox.expand(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _signInWithGoogle(BuildContext sheetContext) async {
    void log(String msg) {
      if (kDebugMode) debugPrint('[HQ GoogleLogin] $msg');
    }

    log('Starting Google sign-in (Firebase).');
    _showLoader(sheetContext);
    final navigator = Navigator.of(sheetContext);
    final messenger = ScaffoldMessenger.of(sheetContext);
    final auth = Provider.of<AuthController>(sheetContext, listen: false);

    try {
      final gsi = GoogleSignIn(scopes: const ['email']);
      log('Calling GoogleSignIn.signIn()');
      final account = await gsi.signIn();
      if (account == null) {
        log('User cancelled Google sign-in (account == null).');
        navigator.pop();
        return;
      }
      log('Google account selected: ${account.email}');

      final googleAuth = await account.authentication;
      final accessToken = googleAuth.accessToken;
      final idToken = googleAuth.idToken;
      if (accessToken == null ||
          accessToken.isEmpty ||
          idToken == null ||
          idToken.isEmpty) {
        log(
          'Missing Google tokens. accessTokenPresent=${accessToken != null} idTokenPresent=${idToken != null}',
        );
        navigator.pop();
        messenger.showSnackBar(
          const SnackBar(
            content: Center(
              child: Text(
                'Could not complete Google sign-in',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(50),
            duration: Duration(milliseconds: 3000),
          ),
        );
        return;
      }

      final credential = GoogleAuthProvider.credential(
        accessToken: accessToken,
        idToken: idToken,
      );

      log('Signing into Firebase with Google credential');
      final userCred = await FirebaseAuth.instance.signInWithCredential(
        credential,
      );
      final user = userCred.user;
      if (user == null) {
        log('FirebaseAuth returned null user');
        navigator.pop();
        messenger.showSnackBar(
          const SnackBar(
            content: Center(
              child: Text(
                'Firebase sign-in failed',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(50),
            duration: Duration(milliseconds: 3000),
          ),
        );
        return;
      }

      final String? firebaseIdToken = await user.getIdToken(true);
      if (firebaseIdToken == null || firebaseIdToken.isEmpty) {
        log('Missing Firebase ID token');
        navigator.pop();
        messenger.showSnackBar(
          const SnackBar(
            content: Center(
              child: Text(
                'Could not get Firebase ID token',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(50),
            duration: Duration(milliseconds: 3000),
          ),
        );
        return;
      }
      final firebaseToken = firebaseIdToken;
      log(
        'Received Firebase ID token. length=${firebaseToken.length} suffix=${firebaseToken.substring(firebaseToken.length - 6)}',
      );

      log('Calling backend: ${AuthEndpoints.catererGoogle}');
      final data = await CatererAuthApi.loginWithGoogleIdToken(firebaseToken);
      log(
        'Backend response keys=${data.keys.toList()} success=${data['success']}',
      );
      if (data['success'] != true) {
        navigator.pop();
        final msg = data['message']?.toString() ?? 'Google sign-in failed';
        log('Backend reported failure message="$msg"');
        messenger.showSnackBar(
          SnackBar(
            content: Center(
              child: Text(
                msg,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(50),
            duration: const Duration(milliseconds: 3000),
          ),
        );
        return;
      }

      final token = data['token']?.toString();
      final refresh = data['refreshToken']?.toString();
      final serverHostelName = data['hostelName']?.toString();
      final hostelName = (serverHostelName == null || serverHostelName.isEmpty)
          ? 'Lohit'
          : serverHostelName;
      if (token == null || refresh == null) {
        log(
          'Invalid server response. tokenPresent=${token != null} refreshPresent=${refresh != null} hostelName="$serverHostelName"',
        );
        navigator.pop();
        messenger.showSnackBar(
          const SnackBar(
            content: Center(
              child: Text(
                'Invalid server response',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
            backgroundColor: Colors.black,
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.all(50),
            duration: Duration(milliseconds: 3000),
          ),
        );
        return;
      }

      log(
        'Saving tokens. hostelName="$hostelName" tokenLen=${token.length} refreshLen=${refresh.length}',
      );
      await auth.signInWithCatererTokens(
        token: token,
        hostelName: hostelName,
        refreshToken: refresh,
      );

      navigator.pop();

      if (!mounted) return;
      navigator.pop();

      if (!mounted) return;
      context.go('/home');

      messenger.showSnackBar(
        const SnackBar(
          content: Center(
            child: Text(
              'Successfully Logged In',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white),
            ),
          ),
          backgroundColor: Colors.black,
          behavior: SnackBarBehavior.floating,
          margin: EdgeInsets.all(50),
          duration: Duration(milliseconds: 1000),
        ),
      );
    } on DioException catch (e) {
      log(
        'DioException: type=${e.type} status=${e.response?.statusCode} dataType=${e.response?.data.runtimeType}',
      );
      navigator.pop();
      final msg = e.response?.data is Map
          ? (e.response!.data['message']?.toString() ?? _getErrorMessage(e))
          : _getErrorMessage(e);
      messenger.showSnackBar(
        SnackBar(
          content: Center(
            child: Text(
              msg,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white),
            ),
          ),
          backgroundColor: Colors.black,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(50),
          duration: const Duration(milliseconds: 3000),
        ),
      );
    } catch (e) {
      log('Unexpected error: $e');
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Center(
            child: Text(
              _getErrorMessage(e),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white),
            ),
          ),
          backgroundColor: Colors.black,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(50),
          duration: const Duration(milliseconds: 3000),
        ),
      );
    }
  }

  void _showBottomSheet(BuildContext context) {
    _controller.forward();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withAlpha(40),
      builder: (BuildContext context) {
        return Stack(
          children: [
            Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: Padding(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 16,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 36,
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          'Sign in to HABit HQ',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 32,
                            height: 48 / 32,
                            color: Themes.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Divider(
                        height: 1,
                        thickness: 1,
                        color: Color(0xFFE8E8EB),
                      ),
                      const SizedBox(height: 16),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          'For mess managers',
                          style: TextStyle(
                            fontWeight: FontWeight.w500,
                            fontSize: 14,
                            height: 20 / 14,
                            color: Themes.textSecondary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      _signInSheetButton(
                        materialColor: Themes.kAccent,
                        outlineSide: null,
                        onTap: () => _signInWithGoogle(context),
                        child: const _GoogleSignInSheetButtonContent(),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
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
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: const [Color(0xFFCBC1EC), Colors.white],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                child: Image.asset(
                  'assets/images/Phone.png',
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(height: isSmallScreen ? 20 : 40),
                    Center(
                      child: SizedBox(
                        width: screenSize.width * 0.9,
                        height: isSmallScreen ? 120 : 152,
                        child: Center(
                          child: SvgPicture.asset(
                            'assets/images/Habit_logo_Purple_colored.svg',
                          ),
                        ),
                      ),
                    ),
                    AnimatedBuilder(
                      animation: _expandAnimation,
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
                                  left:
                                      (40 + 10 * _expandAnimation.value) *
                                      scaleFactor,
                                  top:
                                      (40 - 5 * _expandAnimation.value) *
                                      scaleFactor,
                                  child: Image.asset(
                                    'assets/icon/LoginIcon4.png',
                                    width: 49,
                                    height: 49,
                                  ),
                                ),
                                Positioned(
                                  right:
                                      (40 + 10 * _expandAnimation.value) *
                                      scaleFactor,
                                  top:
                                      (50 - 20 * _expandAnimation.value) *
                                      scaleFactor,
                                  child: Image.asset(
                                    'assets/icon/LoginIcon2.png',
                                    width: 49,
                                    height: 49,
                                  ),
                                ),
                                Positioned(
                                  left:
                                      (10 + 10 * _expandAnimation.value) *
                                      scaleFactor,
                                  top:
                                      (130 - 30 * _expandAnimation.value) *
                                      scaleFactor,
                                  child: Image.asset(
                                    'assets/icon/LoginIcon3.png',
                                    width: 49,
                                    height: 49,
                                  ),
                                ),
                                Positioned(
                                  right:
                                      (0 + 10 * _expandAnimation.value) *
                                      scaleFactor,
                                  top:
                                      (140 - 40 * _expandAnimation.value) *
                                      scaleFactor,
                                  child: Image.asset(
                                    'assets/icon/LoginIcon1.png',
                                    width: 49,
                                    height: 49,
                                  ),
                                ),
                                Positioned(
                                  left: 0,
                                  right: 0,
                                  top: 0 * scaleFactor,
                                  child: Image.asset(
                                    'assets/icon/LoginIcon5.png',
                                    width: 49,
                                    height: 49,
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  left: 0,
                                  top:
                                      (112 - 42 * _expandAnimation.value) *
                                      scaleFactor,
                                  child: Column(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(
                                            alpha: 0.84,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            999,
                                          ),
                                          border: Border.all(
                                            color: Themes.border,
                                          ),
                                        ),
                                        child: const Text(
                                          'Mess Manager App',
                                          style: TextStyle(
                                            color: Themes.textSecondary,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        'Scans, summer\nmess and rebates\nin one place',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Themes.textPrimary,
                                          fontSize: 28 * scaleFactor,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                    Text(
                      'Review live meal scans, handle summer mess approvals\nand verify rebate applications with the same HABit flow.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color.lerp(
                          Themes.textPrimary,
                          Themes.textSecondary,
                          _expandAnimation.value,
                        ),
                        fontSize: 12.5,
                        height: 1.45,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    SafeArea(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 44),
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 300),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: () => _showBottomSheet(context),
                                    child: const Text('Continue'),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Use the manager Google account linked to your mess.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Themes.textSecondary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
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

/// Same visual weight as IITG [LoginButton] (Microsoft), for Google on purple.
class _GoogleSignInSheetButtonContent extends StatelessWidget {
  const _GoogleSignInSheetButtonContent();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Center(
            child: Text(
              'G',
              style: TextStyle(
                color: Color(0xFF4285F4),
                fontWeight: FontWeight.w800,
                fontSize: 14,
                height: 1,
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        const Text(
          'Sign in with Google',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
            fontSize: 14,
            height: 20 / 14,
          ),
        ),
      ],
    );
  }
}
