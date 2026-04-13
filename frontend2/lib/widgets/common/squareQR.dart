// ignore_for_file: file_names

import 'package:flutter/material.dart';

class SquarePainter extends CustomPainter {
  const SquarePainter({
    this.borderColor = Colors.white,
    this.strokeWidth = 3,
  });

  final Color borderColor;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = borderColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rect = Rect.fromLTWH(0, 0, size.width, size.height);

    canvas.drawRect(rect, paint);
  }

  @override
  bool shouldRepaint(covariant SquarePainter oldDelegate) {
    return oldDelegate.borderColor != borderColor ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
