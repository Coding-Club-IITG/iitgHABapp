import 'package:flutter/material.dart';
import 'package:frontend2/apis/authentication/login.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/screens/login_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _appVersion = 'Loading...';

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      setState(() {
        _appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      });
    } catch (e) {
      setState(() {
        _appVersion = 'Unknown';
      });
    }
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: const Text('Logout',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          content: const Text('Are you sure you want to logout?',
              style: TextStyle(fontSize: 14, color: Colors.black87)),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: Text('Cancel',
                  style: TextStyle(color: Colors.grey[600], fontSize: 14)),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                logoutHandler(context);
              },
              child: Text('Logout',
                  style: TextStyle(
                      color: Colors.red[400],
                      fontSize: 14,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        );
      },
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
    final TextEditingController confirmController = TextEditingController();
    bool isDeleting = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              title: const Text(
                'Delete Account',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Are you sure you want to delete your account?',
                      style: TextStyle(
                        fontSize: 15,
                        color: Colors.black87,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'This action will:',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildBulletPoint(
                        'Delete your profile and personal information'),
                    const SizedBox(height: 6),
                    _buildBulletPoint(
                        'Anonymize your hostel and mess subscription data'),
                    const SizedBox(height: 6),
                    _buildBulletPoint(
                        'Anonymize your historical feedback and scan logs'),
                    const SizedBox(height: 20),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.warning_amber_rounded,
                          color: Colors.red[400],
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'This action cannot be undone.',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.red[400],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'To confirm, please type "DELETE" below:',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: confirmController,
                      enabled: !isDeleting,
                      style: const TextStyle(fontSize: 15),
                      decoration: InputDecoration(
                        hintText: 'Type DELETE to confirm',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                      ),
                      onChanged: (value) {
                        setState(() {});
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isDeleting
                      ? null
                      : () {
                          Navigator.of(dialogContext).pop();
                        },
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: Colors.grey[700],
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: isDeleting || confirmController.text != 'DELETE'
                      ? null
                      : () async {
                          setState(() {
                            isDeleting = true;
                          });

                          try {
                            await deleteUserAccount();
                            if (!dialogContext.mounted) return;
                            Navigator.of(dialogContext).pop();
                            // Clear local data and logout
                            final prefs =
                                await SharedPreferences.getInstance();
                            await prefs.clear();
                            if (!context.mounted) return;
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(
                                builder: (context) => const LoginScreen(),
                              ),
                              (route) => false,
                            );
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Account deleted successfully'),
                                backgroundColor: Colors.green,
                              ),
                            );
                          } catch (e) {
                            setState(() {
                              isDeleting = false;
                            });
                            if (!dialogContext.mounted) return;
                            ScaffoldMessenger.of(dialogContext).showSnackBar(
                              SnackBar(
                                content: Text('Error: ${e.toString()}'),
                                backgroundColor: Colors.red,
                              ),
                            );
                          }
                        },
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.resolveWith<Color>(
                      (Set<WidgetState> states) {
                        if (states.contains(WidgetState.disabled)) {
                          return Colors.grey[300]!;
                        }
                        if (confirmController.text == 'DELETE') {
                          return Colors.red[400]!;
                        }
                        return Colors.grey[300]!;
                      },
                    ),
                    foregroundColor: WidgetStateProperty.resolveWith<Color>(
                      (Set<WidgetState> states) {
                        if (states.contains(WidgetState.disabled)) {
                          return Colors.grey[600]!;
                        }
                        if (confirmController.text == 'DELETE') {
                          return Colors.white;
                        }
                        return Colors.grey[600]!;
                      },
                    ),
                    padding: WidgetStateProperty.all(
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                    shape: WidgetStateProperty.all(
                      RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    elevation: WidgetStateProperty.all(0),
                  ),
                  child: isDeleting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Delete Account',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
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

  Widget _buildBulletPoint(String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 7, right: 12),
          child: Container(
            width: 6,
            height: 6,
            margin: const EdgeInsets.only(top: 0),
            decoration: BoxDecoration(
              color: Colors.grey[600],
              shape: BoxShape.circle,
            ),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 0),
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black87,
                height: 1.4,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _openPrivacyPolicy() async {
    const url = 'https://hab.codingclub.in/privacy';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open privacy policy'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _contactSupport() async {
    const url = 'https://hab.codingclub.in/contact';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open contact support page'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _reportBug() async {
    const url = 'https://hab.codingclub.in/bug-report';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open bug report page'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _showAboutDialog() async {
    const url = 'https://hab.codingclub.in';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open website'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "Settings",
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
        ),
        centerTitle: true,
      ),
      body: ListView(
        children: [
          // Support & Information Section
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 16, right: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'Support & Information',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[600],
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      ListTile(
                        leading:
                            const Icon(Icons.privacy_tip_outlined, size: 22),
                        title: const Text('Privacy Policy'),
                        trailing: Icon(Icons.chevron_right,
                            color: Colors.grey[400], size: 20),
                        onTap: _openPrivacyPolicy,
                      ),
                      const Divider(height: 1, indent: 56),
                      ListTile(
                        leading: const Icon(Icons.help_outline, size: 22),
                        title: const Text('Contact Support'),
                        trailing: Icon(Icons.chevron_right,
                            color: Colors.grey[400], size: 20),
                        onTap: _contactSupport,
                      ),
                      const Divider(height: 1, indent: 56),
                      ListTile(
                        leading:
                            const Icon(Icons.bug_report_outlined, size: 22),
                        title: const Text('Report a Bug'),
                        trailing: Icon(Icons.chevron_right,
                            color: Colors.grey[400], size: 20),
                        onTap: _reportBug,
                      ),
                      const Divider(height: 1, indent: 56),
                      ListTile(
                        leading: const Icon(Icons.info_outline, size: 22),
                        title: const Text('About'),
                        trailing: Icon(Icons.chevron_right,
                            color: Colors.grey[400], size: 20),
                        onTap: _showAboutDialog,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Account Section
          Padding(
            padding: const EdgeInsets.only(top: 32, left: 16, right: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'Account',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[600],
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: ListTile(
                    leading: Icon(Icons.delete_outline,
                        size: 22, color: Colors.red[400]),
                    title: Text(
                      'Delete Account',
                      style: TextStyle(color: Colors.red[400]),
                    ),
                    trailing: Icon(Icons.chevron_right,
                        color: Colors.grey[400], size: 20),
                    onTap: () => _showDeleteAccountDialog(context),
                  ),
                ),
              ],
            ),
          ),

          // Logout Section
          Padding(
            padding:
                const EdgeInsets.only(top: 8, bottom: 16, left: 16, right: 16),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              child: ListTile(
                leading: const Icon(Icons.logout,
                    size: 22, color: Color(0xFF6149CD)),
                title: const Text(
                  'Logout',
                  style: TextStyle(color: Color(0xFF6149CD)),
                ),
                trailing: Icon(Icons.chevron_right,
                    color: Colors.grey[400], size: 20),
                onTap: () => _showLogoutDialog(context),
              ),
            ),
          ),

          // App Version
          Padding(
            padding: const EdgeInsets.only(bottom: 32),
            child: Center(
              child: Text(
                'App Version: $_appVersion',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[500],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
