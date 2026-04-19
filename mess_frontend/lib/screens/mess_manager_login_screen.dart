import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../apis/manager_api.dart';
import '../constants/endpoint.dart';
import '../providers/auth_controller.dart';

class MessManagerLoginScreen extends StatefulWidget {
  const MessManagerLoginScreen({super.key});

  @override
  State<MessManagerLoginScreen> createState() => _MessManagerLoginScreenState();
}

class _MessManagerLoginScreenState extends State<MessManagerLoginScreen> {
  final TextEditingController _passwordController = TextEditingController();
  final ValueNotifier<List<String>> _hostels = ValueNotifier<List<String>>(
    <String>[],
  );
  String? _selectedHostel;
  bool _loadingHostels = true;
  bool _loggingIn = false;
  String? _hostelsLoadError;

  @override
  void initState() {
    super.initState();
    _loadHostels();
  }

  Future<void> _loadHostels() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _hostelsLoadError = null;
    });
    try {
      if (kDebugMode) {
        debugPrint(
            '[MessManagerLogin] Starting _loadHostels; endpoint=${HostelEndpoints.allHostels}');
      }
      final hostels = await ManagerApi.fetchHostels();
      if (kDebugMode) {
        debugPrint(
            '[MessManagerLogin] _loadHostels success, got ${hostels.length} hostels');
      }
      if (!mounted) return;
      _hostels.value = hostels;
      await prefs.setStringList('mm_hostels', hostels);
      setState(() {
        _loadingHostels = false;
        if (hostels.isNotEmpty) _selectedHostel ??= hostels.first;
      });
      return;
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('[MessManagerLogin] _loadHostels error: $e');
        debugPrint('[MessManagerLogin] stack: $st');
      }
      final cached = prefs.getStringList('mm_hostels');
      if (cached != null && cached.isNotEmpty) {
        if (!mounted) return;
        _hostels.value = cached;
        setState(() {
          _loadingHostels = false;
          _hostelsLoadError =
              'Could not refresh hostels. Showing cached list.';
          if (cached.isNotEmpty) _selectedHostel ??= cached.first;
        });
        if (kDebugMode) {
          debugPrint(
              '[MessManagerLogin] Using cached hostels (${cached.length})');
        }
        return;
      }
    }

    if (!mounted) return;
    setState(() {
      _loadingHostels = false;
      _hostelsLoadError =
          'Could not load hostels. Check your connection and pull to refresh after reopening the app.';
    });
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _hostels.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final messenger = ScaffoldMessenger.of(context);
    if (_selectedHostel == null || _selectedHostel!.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Please select a hostel')),
      );
      return;
    }
    if (_passwordController.text.trim().isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Please enter the hostel password')),
      );
      return;
    }

    setState(() {
      _loggingIn = true;
    });

    try {
      final data = await ManagerApi.loginManager(
        hostelName: _selectedHostel!,
        password: _passwordController.text.trim(),
      );
      final success = data['success'] == true;
      final token = data['token']?.toString();

      if (!success || token == null) {
        final msg =
            data['message']?.toString() ?? 'Invalid hostel or password.';
        messenger.showSnackBar(SnackBar(content: Text(msg)));
        setState(() {
          _loggingIn = false;
        });
        return;
      }

      if (!mounted) return;
      await context.read<AuthController>().signIn(
            token: token,
            hostelName: _selectedHostel!,
          );
      setState(() {
        _loggingIn = false;
      });
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Login failed: $e')));
      setState(() {
        _loggingIn = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),
              const Text(
                'HABit HQ',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select your hostel and enter the manager password to view mess & Gala Dinner scans.',
                style: TextStyle(
                  color: Color(0xFF4B5563),
                  fontSize: 14,
                ),
              ),
              if (_hostelsLoadError != null) ...[
                const SizedBox(height: 12),
                Text(
                  _hostelsLoadError!,
                  style: const TextStyle(
                    color: Color(0xFFB91C1C),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              SizedBox(height: size.height * 0.04),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 20,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 12,
                      offset: Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hostel',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_loadingHostels)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    else
                      ValueListenableBuilder<List<String>>(
                        valueListenable: _hostels,
                        builder: (context, hostels, _) {
                          return Theme(
                            data: Theme.of(context)
                                .copyWith(canvasColor: Colors.white),
                            child: DropdownButtonFormField<String>(
                              initialValue: _selectedHostel,
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFFF9FAFB),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFE5E7EB),
                                  ),
                                ),
                              ),
                              dropdownColor: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              iconEnabledColor: const Color(0xFF111827),
                              iconDisabledColor: const Color(0xFF9CA3AF),
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF111827),
                              ),
                              items: hostels
                                  .map(
                                    (h) => DropdownMenuItem<String>(
                                      value: h,
                                      child: Text(
                                        h,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Color(0xFF111827),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                setState(() {
                                  _selectedHostel = value;
                                });
                              },
                              hint: const Text(
                                'Select hostel',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    const SizedBox(height: 16),
                    const Text(
                      'Password',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _passwordController,
                      obscureText: true,
                      style: const TextStyle(
                        color: Color(0xFF111827),
                        fontSize: 14,
                      ),
                      cursorColor: const Color(0xFF4C4EDB),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFFF9FAFB),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: Color(0xFFE5E7EB),
                          ),
                        ),
                        hintText: 'Enter hostel password',
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _loggingIn ? null : _login,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4C4EDB),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _loggingIn
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : const Text(
                                'Continue',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
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
