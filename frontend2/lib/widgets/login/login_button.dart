import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';

class LoginButton extends StatelessWidget {
  const LoginButton({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.asset(
          'assets/fonts/microsoft.svg',
          width: 24,
          height: 24,
        ),
        const SizedBox(width: 16),
        const Text(
          'Sign in with Microsoft',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w500,
            fontSize: 14,
            height: 20 / 14,
          ),
        ),
      ],
    );
  }
}