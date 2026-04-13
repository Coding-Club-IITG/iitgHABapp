// notification_card.dart

import 'package:flutter/material.dart';
import 'package:frontend2/constants/app_ui_tokens.dart';
import 'package:frontend2/utilities/notifications.dart';

class NotificationCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final String? redirectType;
  final int? notificationIndex;
  final bool isRead;
  final bool isAlert;

  const NotificationCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.description,
    this.redirectType,
    this.notificationIndex,
    this.isRead = false,
    this.isAlert = false,
  });

  IconData _iconForRedirect(String? type) {
    switch (type) {
      case 'mess_screen':
        return Icons.restaurant_rounded;
      case 'mess_change':
        return Icons.swap_horiz_rounded;
      case 'profile':
        return Icons.person_rounded;
      default:
        return Icons.notifications_none_rounded;
    }
  }

  Future<void> _handleTap(BuildContext context) async {
    if (!isRead && notificationIndex != null) {
      await markNotificationAsRead(notificationIndex!);
    }

    if (redirectType == null) return;

    switch (redirectType) {
      case 'mess_screen':
        tabNavigationNotifier.value = 1;
        feedbackRefreshNotifier.value = !feedbackRefreshNotifier.value;
        if (context.mounted) {
          Navigator.of(context).pop();
        }
        break;
      case 'mess_change':
        tabNavigationNotifier.value = 0;
        deepNavigationNotifier.value = 'mess_change_screen';
        break;
      case 'profile':
        tabNavigationNotifier.value = 0;
        deepNavigationNotifier.value = 'profile_screen';
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _handleTap(context),
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          decoration: AppUi.cardDecoration(
            radius: 12,
            backgroundColor: AppUi.surface,
            borderColor: AppUi.border,
          ),
          child: Opacity(
            opacity: isRead ? 0.52 : 1.0,
            child: Padding(
              padding: const EdgeInsets.all(14.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppUi.blueSoft,
                    child: Icon(
                      _iconForRedirect(redirectType),
                      size: 16,
                      color: AppUi.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                style: TextStyle(
                                  fontSize: 15,
                                  height: 20 / 15,
                                  fontWeight: isRead
                                      ? FontWeight.w500
                                      : FontWeight.w600,
                                  color: AppUi.textPrimary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              description,
                              style: const TextStyle(
                                fontSize: 12,
                                height: 16 / 12,
                                fontWeight: FontWeight.w500,
                                color: AppUi.textMuted,
                              ),
                            ),
                          ],
                        ),
                        if (isAlert) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppUi.yellowSoft,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: const Color(0xFFE5D9B4),
                              ),
                            ),
                            child: const Text(
                              'Alert',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppUi.yellow,
                              ),
                            ),
                          ),
                        ],
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            subtitle,
                            style: const TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w400,
                              color: Color(0xFF2E2F31),
                            ),
                          ),
                        ],
                        if (redirectType != null) ...[
                          const SizedBox(height: 8),
                          const Row(
                            children: [
                              Text(
                                'Open',
                                style: TextStyle(
                                  fontSize: 14,
                                  height: 20 / 14,
                                  fontWeight: FontWeight.w500,
                                  color: AppUi.primary,
                                ),
                              ),
                              SizedBox(width: 2),
                              Icon(
                                Icons.chevron_right_rounded,
                                size: 16,
                                color: AppUi.primary,
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
