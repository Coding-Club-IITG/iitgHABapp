import 'package:flutter/material.dart';
import 'package:frontend2/models/mess_menu_model.dart';

class MessMenuCard extends StatelessWidget {
  final List<MenuModel> menus;
  final DateTime now;
  final DateTime Function(String) parseTime;
  final String Function(Duration) formatDuration;

  const MessMenuCard({
    super.key,
    required this.menus,
    required this.now,
    required this.parseTime,
    required this.formatDuration,
  });

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF1DB954);

    // Find which meal to show and what status
    MenuModel? currentMenu;
    String statusText = "";
    Color statusColor = const Color(0xFF1F8441);

    for (final menu in menus) {
      final start = parseTime(menu.startTime);
      final end = parseTime(menu.endTime);
      if (now.isBefore(start)) {
        // Not started yet
        final diff = start.difference(now);
        final h = diff.inHours;
        final m = diff.inMinutes.remainder(60);
        statusText = "In ${h > 0 ? '${h}h ' : ''}${m}m";
        currentMenu = menu;
        statusColor = green;
        break;
      } else if (now.isAfter(start) && now.isBefore(end)) {
        // Ongoing
        statusText = "Ongoing";
        currentMenu = menu;
        statusColor = green;
        break;
      }
    }

    // If no future/ongoing meal, show last meal as ended
    currentMenu ??= menus.last;
    if (statusText == "") {
      statusText = "is over";
      statusColor = Colors.grey;
    }

    final dishSection =
        currentMenu.items.where((item) => item.type == "Dish").toList();
    final breadsRice = currentMenu.items
        .where((item) => item.type == "Breads and Rice")
        .toList();
    final others =
        currentMenu.items.where((item) => item.type == "Others").toList();

    return Card(
      color: Colors.white,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(
            width: 1,
            color: Color(0xFFC5C5D1),
          )),
      elevation: 0.5,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment:
                  MainAxisAlignment.spaceBetween, // space-between
              crossAxisAlignment: CrossAxisAlignment.center,

              children: [
                Text(
                  "${currentMenu.type} ",
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                Text(
                  statusText,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const Spacer(),
                Text(
                  "${currentMenu.startTime} - ${currentMenu.endTime}",
                  style: const TextStyle(
                    color: Colors.black54,
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              "DISH",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                letterSpacing: 0.5,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 4),
            ...dishSection.isNotEmpty
                ? dishSection
                    .map((item) => Row(
                          children: [
                            Text(item.name,
                                style: const TextStyle(fontSize: 15)),
                            if (item.isLiked == true)
                              const Padding(
                                padding: EdgeInsets.only(left: 6.0),
                                child: Icon(Icons.favorite,
                                    color: Colors.red, size: 16),
                              ),
                          ],
                        ))
                    .toList()
                : [
                    const Text("No main dishes", style: TextStyle(fontSize: 15))
                  ],
            const SizedBox(height: 10),
            const Divider(thickness: 1, height: 24),
            if (breadsRice.isEmpty)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "OTHERS",
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ...others.isNotEmpty
                      ? others
                          .map((item) => Row(
                                children: [
                                  Text(item.name,
                                      style: const TextStyle(fontSize: 15)),
                                  if (item.isLiked == true)
                                    const Padding(
                                      padding: EdgeInsets.only(left: 6.0),
                                      child: Icon(Icons.favorite,
                                          color: Colors.red, size: 16),
                                    ),
                                ],
                              ))
                          .toList()
                      : [const Text("-", style: TextStyle(fontSize: 15))],
                ],
              )
            else
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "BREADS & RICE",
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          ...breadsRice
                              .map((item) => Row(
                                    children: [
                                      Text(item.name,
                                          style: const TextStyle(
                                              fontSize: 15)),
                                      if (item.isLiked == true)
                                        const Padding(
                                          padding: EdgeInsets.only(left: 6.0),
                                          child: Icon(Icons.favorite,
                                              color: Colors.red, size: 16),
                                        ),
                                    ],
                                  ))
                              ,
                        ],
                      ),
                    ),
                    VerticalDivider(
                      thickness: 1,
                      width: 32,
                      color: Colors.grey.shade300,
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "OTHERS",
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          ...others.isNotEmpty
                              ? others
                                  .map((item) => Row(
                                        children: [
                                          Text(item.name,
                                              style: const TextStyle(
                                                  fontSize: 15)),
                                          if (item.isLiked == true)
                                            const Padding(
                                              padding:
                                                  EdgeInsets.only(left: 6.0),
                                              child: Icon(Icons.favorite,
                                                  color: Colors.red,
                                                  size: 16),
                                            ),
                                        ],
                                      ))
                                  .toList()
                              : [
                                  const Text("-",
                                      style: TextStyle(fontSize: 15))
                                ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
