import 'dart:async';

import 'package:flutter/material.dart';
import '../../models/mess_menu_model.dart';
import '../../apis/mess/menu_like.dart';

class InteractiveMessMenuCard extends StatefulWidget {
  final List<MenuModel> menus;
  final DateTime Function(String) parseTime;
  final String Function(Duration) formatDuration;
  final String currentMessId;
  final String? userMessId; // User's subscribed mess ID

  const InteractiveMessMenuCard({
    super.key,
    required this.menus,
    required this.parseTime,
    required this.formatDuration,
    required this.currentMessId,
    this.userMessId,
  });

  @override
  State<InteractiveMessMenuCard> createState() =>
      _InteractiveMessMenuCardState();
}

class _InteractiveMessMenuCardState extends State<InteractiveMessMenuCard> {
  late List<MenuModel> _menus;
  bool _isLikeEnabled = false;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _menus = widget.menus;
    _checkLikeEnabled();
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(InteractiveMessMenuCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentMessId != widget.currentMessId ||
        oldWidget.userMessId != widget.userMessId) {
      _checkLikeEnabled();
    }
    if (oldWidget.menus != widget.menus) {
      _menus = widget.menus;
    }
  }

  void _checkLikeEnabled() {
    setState(() {
      _isLikeEnabled = widget.userMessId != null &&
          widget.userMessId == widget.currentMessId;
    });
  }

  Future<void> _toggleLike(
      String menuItemId, int menuIndex, int itemIndex) async {
    if (!_isLikeEnabled) return;

    // Optimistic update
    setState(() {
      _menus[menuIndex].items[itemIndex].isLiked =
          !_menus[menuIndex].items[itemIndex].isLiked;
    });

    // Make API call
    final success = await MenuLikeAPI.toggleLike(menuItemId);

    if (!success) {
      // Revert if API call failed
      setState(() {
        _menus[menuIndex].items[itemIndex].isLiked =
            !_menus[menuIndex].items[itemIndex].isLiked;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update favorite')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF1DB954);
    final now = DateTime.now();

    // Find which meal to show and what status
    MenuModel? currentMenu;
    String statusText = "";
    Color statusColor = const Color(0xFF1F8441);

    for (final menu in _menus) {
      final start = widget.parseTime(menu.startTime);
      final end = widget.parseTime(menu.endTime);
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
    currentMenu ??= _menus.last;
    if (statusText == "") {
      statusText = "is over";
      statusColor = Colors.grey;
    }

    final menuIndex = _menus.indexOf(currentMenu);
    final dishSection =
        currentMenu.items.where((item) => item.type == "Dish").toList();
    final breadsRice = currentMenu.items
        .where((item) => item.type == "Breads and Rice")
        .toList();
    final others =
        currentMenu.items.where((item) => item.type == "Others").toList();

    Widget buildMenuItem(MenuItemModel item) {
      final itemIndex = currentMenu!.items.indexOf(item);
      return GestureDetector(
        onTap: _isLikeEnabled
            ? () => _toggleLike(item.id, menuIndex, itemIndex)
            : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2.0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  item.name,
                  style: const TextStyle(fontSize: 15),
                ),
              ),
              if (item.isLiked == true)
                const Padding(
                  padding: EdgeInsets.only(left: 6.0),
                  child: Icon(Icons.favorite, color: Colors.red, size: 16),
                ),
              if (_isLikeEnabled && item.isLiked != true)
                const Padding(
                  padding: EdgeInsets.only(left: 6.0),
                  child:
                      Icon(Icons.favorite_border, color: Colors.grey, size: 16),
                ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        Card(
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(width: 1, color: Color(0xFFC5C5D1)),
          ),
          elevation: 0.5,
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                    ? dishSection.map((item) => buildMenuItem(item)).toList()
                    : [
                        const Text("No main dishes",
                            style: TextStyle(fontSize: 15))
                      ],
                const SizedBox(height: 10),
                const Divider(thickness: 1, height: 24),
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // BREADS & RICE
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
                            ...breadsRice.isNotEmpty
                                ? breadsRice
                                    .map((item) => buildMenuItem(item))
                                    .toList()
                                : [
                                    const Text("-",
                                        style: TextStyle(fontSize: 15))
                                  ],
                          ],
                        ),
                      ),
                      VerticalDivider(
                        thickness: 1,
                        width: 32,
                        color: Colors.grey.shade300,
                      ),
                      // OTHERS
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
                                    .map((item) => buildMenuItem(item))
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
        ),
        if (_isLikeEnabled)
          const Padding(
            padding: EdgeInsets.only(top: 8.0),
            child: Text(
              "Tap on a food item to mark as favourite",
              style: TextStyle(fontSize: 12, color: Colors.black54),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }
}
