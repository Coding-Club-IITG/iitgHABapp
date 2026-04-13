import 'package:flutter/material.dart';
import 'package:frontend2/providers/notifications.dart';
import 'package:frontend2/screens/notification.dart';

class AlertsCard extends StatefulWidget {
  const AlertsCard(
      {super.key, this.feedbackform = false, this.daysLeft = 2});
  final bool feedbackform;
  final int daysLeft;

  @override
  State<AlertsCard> createState() => _AlertsCardState();
}

class _AlertsCardState extends State<AlertsCard> {
  int expandedSection = 2;

  // int num_notification = 0;

  // Future<void> _loadNotificationCount() async {
  //   final prefs = await SharedPreferences.getInstance();
  //   final List<String> stored = prefs.getStringList('notifications') ?? [];
  //   setState(() {
  //     num_notification = stored.length;
  //   });
  // }

  @override
  void initState() {
    super.initState();
    // SharedPreferences.getInstance().then((prefs) => {setState(() {
    //   num_notification = (prefs.getStringList('notifications') ?? []).length;
    //   // Firebase Messaging setup
    //   FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
    //       setState(() {
    //         num_notification += 1;
    //         //storedNotifications = stored;
    //       });
    //     });
    //   }
    // )});
  }

  @override
  Widget build(BuildContext context) {
    Widget sectionHeader(String title, int section, {Widget? trailing}) {
      return Row(
        children: [
          CircleAvatar(
              radius: 12,
              backgroundColor: Colors.red[50],
              child: Icon(Icons.warning_amber_outlined,
                  weight: 20, color: Colors.red[800], size: 16)),
          const SizedBox(width: 12),

          Text(title,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Colors.red[800],
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                  )),

          if (trailing != null) ...[const SizedBox(width: 6), trailing],
          // const Spacer(),
          // Icon(
          //   expandedSection == section
          //       ? Icons.keyboard_arrow_up_rounded
          //       : Icons.keyboard_arrow_down_rounded,
          //   color: Colors.black38,
          // ),
        ],
      );
    }

    return Column(
      children: [
        Card(
          color: Colors.white,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.red[800]!, width: 0.5)),
          elevation: 0.5,
          child: Padding(
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                //sectionHeader("Complaints", 1),
                //sectionBody(1),
                //const SizedBox(height: 16),
                //if (expandedSection != 1) const Divider(),
                //sectionHeader("Mess", 2),
                //sectionBody(2),
                //const SizedBox(height: 16),
                //if (expandedSection != 2)
                //const Divider(),

                sectionHeader(
                  "Alerts",
                  3,
                ),
                // Alerts section - show active alerts
                ValueListenableBuilder(
                  valueListenable: NotificationProvider.notificationProvider,
                  builder: (context, storedNotifications, child) {
                    final activeAlerts = storedNotifications
                        .where((n) => n.isAlertActive && !n.isRead)
                        .toList();
                    if (activeAlerts.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 18.0),
                        child: Center(
                          child: Text(
                            "nothing to be worried about",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ),
                      );
                    }
                    return Padding(
                      padding: const EdgeInsets.only(top: 16.0, bottom: 8.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: activeAlerts.map((alert) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16.0),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(
                                      top: 6.0, right: 12.0),
                                  child: Container(
                                    width: 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: Colors.red[800],
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        alert.title,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 15,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        alert.body,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Colors.black87,
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    );
                  },
                )
              ],
            ),
          ),
        ),
        // Notifications Card
        GestureDetector(
          onTap: () {
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              isDismissible: true,
              backgroundColor: Colors.transparent,
              barrierColor: Colors.black.withValues(alpha: 0.35),
              builder: (context) => const NotificationScreen(),
            );
          },
          child: Card(
            color: Colors.white,
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
                    valueListenable: NotificationProvider.notificationProvider,
                    builder: (context, storedNotifications, child) {
                      final unreadCount =
                          storedNotifications.where((n) => !n.isRead).length;
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
        ),
      ],
    );
  }
}
