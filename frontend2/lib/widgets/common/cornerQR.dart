// ignore_for_file: file_names

import 'package:flutter/material.dart';

class CornerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.purple
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke;

    const double cornerLength = 20.0; // Length of the corner lines

    // Top-left corner
    canvas.drawLine(
      const Offset(0, 0),
      const Offset(0, cornerLength),
      paint,
    ); // Vertical line
    canvas.drawLine(
      const Offset(0, 0),
      const Offset(cornerLength, 0),
      paint,
    ); // Horizontal line

    // Top-right corner
    canvas.drawLine(
      Offset(size.width, 0),
      Offset(size.width - cornerLength, 0),
      paint,
    ); // Horizontal line
    canvas.drawLine(
      Offset(size.width, 0),
      Offset(size.width, cornerLength),
      paint,
    ); // Vertical line

    // Bottom-left corner
    canvas.drawLine(
      Offset(0, size.height),
      Offset(0, size.height - cornerLength),
      paint,
    ); // Vertical line
    canvas.drawLine(
      Offset(0, size.height),
      Offset(cornerLength, size.height),
      paint,
    ); // Horizontal line

    // Bottom-right corner
    canvas.drawLine(
      Offset(size.width, size.height),
      Offset(size.width - cornerLength, size.height),
      paint,
    ); // Horizontal line
    canvas.drawLine(
      Offset(size.width, size.height),
      Offset(size.width, size.height - cornerLength),
      paint,
    ); // Vertical line
  }

  @override
  bool shouldRepaint(CornerPainter oldDelegate) => false;
}
