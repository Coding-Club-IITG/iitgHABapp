import 'package:flutter/material.dart';
import 'package:frontend2/apis/authentication/login.dart';

class MicrosoftRequiredDialog extends StatelessWidget {
  final String featureName;

  const MicrosoftRequiredDialog({super.key, required this.featureName});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      title: const Text(
        'Link Student Account Required',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          fontFamily: 'OpenSans_regular',
        ),
      ),
      content: Text(
        'To use $featureName, you need to link your Student Account. '
        'This helps us verify your institute roll number and confirm you are a registered student.',
        style: const TextStyle(
          fontSize: 14,
          color: Colors.black87,
          fontFamily: 'OpenSans_regular',
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
              fontFamily: 'OpenSans_regular',
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
              fontFamily: 'OpenSans_regular',
            ),
          ),
        ),
      ],
    );
  }
}

