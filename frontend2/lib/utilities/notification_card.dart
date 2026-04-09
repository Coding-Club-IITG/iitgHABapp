// notification_card.dart

import 'package:flutter/material.dart';
import 'package:frontend2/utilities/notifications.dart';

class NotificationCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final String? redirectType;
  final int? notificationIndex; // Index to mark as read
  final bool isRead;

  const NotificationCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.description,
    this.redirectType,
    this.notificationIndex,
    this.isRead = false,
  });

  Future<void> _handleTap(BuildContext context) async {
    // Mark as read if not already read and index is provided
    if (!isRead && notificationIndex != null) {
      await markNotificationAsRead(notificationIndex!);
    }

    // Navigate based on redirect type
    if (redirectType == null) return;

    switch (redirectType) {
      case 'mess_screen':
        // Switch to Mess tab (index 1)
        tabNavigationNotifier.value = 1;
        feedbackRefreshNotifier.value = !feedbackRefreshNotifier.value;
        // Close any open bottom sheets (notification list)
        if (context.mounted) {
          Navigator.of(context).pop();
        }
        break;
      case 'mess_change':
        // Navigate to Mess Change screen
        tabNavigationNotifier.value = 0;
        deepNavigationNotifier.value = 'mess_change_screen';
        break;
      case 'profile':
        // Navigate to Profile screen
        tabNavigationNotifier.value = 0;
        deepNavigationNotifier.value = 'profile_screen';
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Use different opacity for read notifications
    final double opacity = isRead ? 0.6 : 1.0;

    return InkWell(
      onTap: redirectType != null ? () => _handleTap(context) : null,
      borderRadius: BorderRadius.circular(12),
      child: Opacity(
        opacity: opacity,
        child: Card(
          color: Colors.white,
          margin: const EdgeInsets.symmetric(vertical: 8),
          elevation: 1,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title and date/time
                Row(children: [
                  Expanded(
                    child: Text(title,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(color: Colors.grey[600], fontSize: 14)),
                  ),
                ]),
                Divider(color: Colors.grey[300], height: 16),
                const SizedBox(height: 4),
                Text(subtitle, style: TextStyle(color: Colors.grey[700])),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(color: Colors.grey[500], fontSize: 12),
                ),
                // Only show "View →" if redirect is available
                if (redirectType != null) ...[
                  const SizedBox(height: 12),
                  const Row(
                    children: [
                      Text("View  ",
                          style: TextStyle(color: Colors.blue, fontSize: 14)),
                      Icon(Icons.arrow_forward, size: 14, color: Colors.blue),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
