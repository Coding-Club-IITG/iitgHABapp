import 'package:flutter/material.dart';

class ConfirmationDialog extends StatelessWidget {
  final VoidCallback onConfirm;

  const ConfirmationDialog({super.key, required this.onConfirm});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(32),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 30),
            const Icon(Icons.check_circle_outline,
                color: Color.fromRGBO(57, 77, 198, 1), size: 48),
            const SizedBox(height: 16),
            const Text(
              "Your choice has been submitted",
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w300),
            ),
            const SizedBox(height: 8),
            const Text(
              "successfully",
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w400,
                color: Color.fromRGBO(57, 77, 198, 1),
              ),
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: onConfirm, // Call the onConfirm callback
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromRGBO(57, 77, 198, 1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 39, vertical: 12),
              ),
              child: const Text(
                "Close",
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
