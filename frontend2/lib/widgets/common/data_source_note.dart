import 'package:flutter/material.dart';

class SmcDataSourceNote extends StatelessWidget {
  final String text;
  final bool compact;
  final EdgeInsetsGeometry? margin;

  const SmcDataSourceNote({
    super.key,
    this.text = ' Data as provided by your HMC',
    this.compact = false,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      child: Text(
        '* $text',
        style: TextStyle(
          fontFamily: 'OpenSans_regular',
          fontSize: compact ? 11 : 12,
          fontWeight: FontWeight.w600,
          color: const Color(0xFFA1A8AE),
        ),
      ),
    );
  }
}
