import 'package:flutter/material.dart';
import 'package:frontend2/providers/notifications.dart';
import 'package:frontend2/screens/notification.dart';

class NotificationButtonCard extends StatelessWidget {
  const NotificationButtonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => const NotificationScreen(),
        );
      },
      child: Card(
        color: Colors.white,
        margin: const EdgeInsets.only(bottom: 16), // Margin for spacing
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 0.5,
        child: Padding(
          padding: const EdgeInsets.all(18.0),
          child: Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: Colors.blue[50],
                child: const Icon(
                  Icons.notifications_none,
                  size: 16,
                  color: Colors.blue,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                "Notifications",
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w500,
                      fontSize: 16,
                    ),
              ),
              ValueListenableBuilder(
                // This listens to the standard history, NOT the active alerts
                valueListenable: NotificationProvider.notificationProvider,
                builder: (context, storedNotifications, child) {
                  final unreadCount =
                      storedNotifications.where((n) => !n.isRead).length;
                  
                  if (unreadCount == 0) return const SizedBox.shrink();

                  return Text(
                    " ($unreadCount)",
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.black,
                          fontWeight: FontWeight.w500,
                          fontSize: 16,
                        ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
