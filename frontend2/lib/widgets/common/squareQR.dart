// ignore_for_file: file_names

import 'package:flutter/material.dart';

class SquarePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF4C4EDB) // keep your color
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke;

    final rect = Rect.fromLTWH(0, 0, size.width, size.height);

    canvas.drawRect(rect, paint); // 👈 full box
  }

  @override
  bool shouldRepaint(SquarePainter oldDelegate) => false;
}
