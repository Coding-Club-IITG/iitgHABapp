import 'package:flutter/material.dart';
import 'package:frontend2/constants/app_ui_tokens.dart';
import 'package:frontend2/models/notification_model.dart';
import 'package:frontend2/widgets/common/notification_card.dart';
import 'package:frontend2/providers/notification_provider.dart';
import 'package:provider/provider.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  static const double _sheetHostHeightFactor = 0.92;
  static const double _initialChildSize = 0.85;

  late final DraggableScrollableController _sheetController;

  @override
  void initState() {
    super.initState();
    _sheetController = DraggableScrollableController();
    _sheetController.addListener(_onSheetExtentChanged);
  }

  void _onSheetExtentChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _sheetController.removeListener(_onSheetExtentChanged);
    _sheetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final h = MediaQuery.sizeOf(context).height;
    final sheetMaxHeight = h * _sheetHostHeightFactor;
    // Visible panel height = extent * host height. Everything above that inside
    // DraggableScrollableSheet still hit-tests and blocks the modal barrier.
    final extent =
        _sheetController.isAttached ? _sheetController.size : _initialChildSize;
    final topDismissHeight = (h - extent * sheetMaxHeight).clamp(0.0, h);

    return Stack(
      fit: StackFit.expand,
      children: [
        Align(
          alignment: Alignment.bottomCenter,
          child: SizedBox(
            height: sheetMaxHeight,
            child: DraggableScrollableSheet(
              controller: _sheetController,
              initialChildSize: _initialChildSize,
              minChildSize: 0.6,
              maxChildSize: 0.95,
              builder: (context, controller) {
                return DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppUi.surface,
                    borderRadius:
                        const BorderRadius.vertical(top: Radius.circular(16)),
                    boxShadow: AppUi.cardShadow,
                  ),
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 8, bottom: 4),
                        child: Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            margin: const EdgeInsets.only(bottom: 4),
                            decoration: const BoxDecoration(
                              color: AppUi.sheetHandle,
                              borderRadius:
                                  BorderRadius.all(Radius.circular(999)),
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const CircleAvatar(
                              radius: 12,
                              backgroundColor: AppUi.blueSoft,
                              child: Icon(
                                Icons.notifications_none_rounded,
                                size: 16,
                                color: AppUi.blue,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Consumer<NotificationProvider>(
                                builder: (context, provider, _) {
                                  final notifications =
                                      provider.notificationHistory;
                                  final unread = notifications
                                      .where((n) => !n.isRead)
                                      .length;
                                  return Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Notifications',
                                        style: AppUi.sheetTitle,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        unread == 0
                                            ? 'You\'re all caught up'
                                            : '$unread unread',
                                        style: AppUi.sheetSubtitle,
                                      ),
                                    ],
                                  );
                                },
                              ),
                            ),
                            Consumer<NotificationProvider>(
                              builder: (context, provider, _) {
                                final notifications =
                                    provider.notificationHistory;
                                final hasUnread =
                                    notifications.any((n) => !n.isRead);
                                if (!hasUnread) return const SizedBox.shrink();
                                return TextButton(
                                  onPressed: () async {
                                    await context
                                        .read<NotificationProvider>()
                                        .markAllNotificationsAsRead();
                                  },
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppUi.primary,
                                    visualDensity: VisualDensity.compact,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8),
                                  ),
                                  child: const Text(
                                    'Mark all read',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                      Container(
                        height: 1,
                        color: AppUi.sectionDivider,
                      ),
                      Expanded(
                        child: Consumer<NotificationProvider>(
                          builder: (context, provider, child) {
                            final List<NotificationModel> notifications =
                                provider.notificationHistory.toList();

                            if (notifications.isEmpty) {
                              return CustomScrollView(
                                controller: controller,
                                physics: const BouncingScrollPhysics(),
                                slivers: const [
                                  SliverFillRemaining(
                                    hasScrollBody: false,
                                    child: _EmptyNotifications(),
                                  ),
                                ],
                              );
                            }

                            return ListView.separated(
                              controller: controller,
                              physics: const BouncingScrollPhysics(),
                              padding: EdgeInsets.fromLTRB(
                                  16, 16, 16, 24 + bottomInset),
                              itemCount: notifications.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final reversedNotifications =
                                    notifications.reversed.toList();
                                final notif = reversedNotifications[index];
                                final actualIndex =
                                    notifications.length - 1 - index;

                                return NotificationCard(
                                  title: notif.title,
                                  subtitle: notif.body,
                                  description: notif.formattedDateTime,
                                  redirectType: notif.redirectType,
                                  notificationIndex: actualIndex,
                                  isRead: notif.isRead,
                                );
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: topDismissHeight,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).maybePop(),
            child: const ColoredBox(color: Colors.transparent),
          ),
        ),
      ],
    );
  }
}

class _EmptyNotifications extends StatelessWidget {
  const _EmptyNotifications();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircleAvatar(
              radius: 22,
              backgroundColor: AppUi.blueSoft,
              child: Icon(
                Icons.notifications_off_outlined,
                size: 28,
                color: AppUi.blue,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'No notifications yet',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                height: 24 / 16,
                color: AppUi.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'When there\'s an update about mess, profile, or other alerts, '
              'it will show up here.',
              textAlign: TextAlign.center,
              style: AppUi.sheetSubtitle.copyWith(height: 1.45),
            ),
          ],
        ),
      ),
    );
  }
}
