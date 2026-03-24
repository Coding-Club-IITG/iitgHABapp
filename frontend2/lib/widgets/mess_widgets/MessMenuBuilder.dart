// ignore_for_file: file_names

import 'package:flutter/material.dart';
import 'package:frontend2/widgets/mess_widgets/interactive_mess_menu.dart';

import '../../apis/mess/mess_menu.dart';
import '../../models/mess_menu_model.dart';

// Update your MenuFutureBuilder
class MenuFutureBuilder extends StatelessWidget {
  final String messId;
  final String day;
  final String? userMessId; // Add this parameter

  const MenuFutureBuilder({
    super.key,
    required this.messId,
    required this.day,
    this.userMessId,
  });

  DateTime _parseTime(String timeStr) {
    final now = DateTime.now();
    final parts = timeStr.split(':');
    return DateTime(
      now.year,
      now.month,
      now.day,
      int.parse(parts[0]),
      int.parse(parts[1]),
    );
  }

  String _formatDuration(Duration d) {
    if (d.inSeconds <= 0) return "Ended";
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    if (h > 0) {
      return "${h}h ${m}m";
    } else {
      return "${m}m";
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<MenuModel>>(
      future: fetchMenu(messId, day),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Card(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(24)),
              side: BorderSide(color: Color(0xFFC5C5D1), width: 1),
            ),
            elevation: 0.5,
            child: Padding(
              padding: EdgeInsets.all(18.0),
              child: Center(child: CircularProgressIndicator()),
            ),
          );
        } else if (snapshot.hasError) {
          return SizedBox(
            width: double.infinity,
            child: Card(
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: const BorderSide(color: Color(0xFFC5C5D1), width: 1),
              ),
              elevation: 0.5,
              child: const Padding(
                padding: EdgeInsets.all(18.0),
                child: Text(
                  'Unable to fetch menu',
                  style: TextStyle(color: Colors.red),
                ),
              ),
            ),
          );
        } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0.5,
            child: const Padding(
              padding: EdgeInsets.all(18.0),
              child: Text(
                'No menu available today.',
                style: TextStyle(fontSize: 15, color: Colors.black54),
              ),
            ),
          );
        }

        return InteractiveMessMenuCard(
          menus: snapshot.data!,
          parseTime: _parseTime,
          formatDuration: _formatDuration,
          currentMessId: messId,
          userMessId: userMessId,
        );
      },
    );
  }
}
