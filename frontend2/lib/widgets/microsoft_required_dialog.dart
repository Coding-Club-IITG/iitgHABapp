import 'package:flutter/material.dart';
import 'package:frontend2/apis/authentication/login.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MicrosoftRequiredDialog extends StatelessWidget {
  final String featureName;

  const MicrosoftRequiredDialog({super.key, required this.featureName});

  Future<String> _getAuthProviderMessage() async {
    final prefs = await SharedPreferences.getInstance();
    final guestIdentifier = prefs.getString('guestIdentifier');
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;

    // Check if user is a guest user
    if (guestIdentifier != null && !hasMicrosoftLinked) {
      return 'Your guest authentication is complete and sufficient to use the app.';
    }
    // Otherwise, assume Apple user (since Microsoft users wouldn't see this dialog)
    return 'Your Sign in with Apple authentication is complete and sufficient to use the app.';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _getAuthProviderMessage(),
      builder: (context, snapshot) {
        final authMessage = snapshot.data ??
            'Your authentication is complete and sufficient to use the app.';
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          title: const Text(
            'Link Student Account to Access Feature',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          content: Text(
            'To access $featureName, you can optionally link your Student Account. '
            'This allows us to verify your institute roll number to enable student-specific features. '
            '$authMessage',
            style: const TextStyle(
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 14,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                try {
                  await linkMicrosoftAccount();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Center(
                          child: Text(
                            'Student Account linked successfully',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white),
                          ),
                        ),
                        backgroundColor: Colors.black,
                        behavior: SnackBarBehavior.floating,
                        margin: EdgeInsets.all(50),
                        duration: Duration(milliseconds: 2000),
                      ),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Center(
                          child: Text(
                            'Failed to link Student Account',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white),
                          ),
                        ),
                        backgroundColor: Colors.black,
                        behavior: SnackBarBehavior.floating,
                        margin: EdgeInsets.all(50),
                        duration: Duration(milliseconds: 2000),
                      ),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4C4EDB),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'Link Account',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
