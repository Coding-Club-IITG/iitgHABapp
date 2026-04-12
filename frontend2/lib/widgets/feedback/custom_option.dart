import 'package:flutter/material.dart';

Widget customOption({
  required String text,
  required String groupValue,
  required String value,
  required Function(String) onChanged,
}) {
  bool isSelected = groupValue == value;

  return GestureDetector(
    onTap: () => onChanged(value),
    child: Container(
      height: 56,
      margin: const EdgeInsets.symmetric(vertical: 4.5*7/6),
      padding: const EdgeInsets.symmetric(vertical: 10.5*7/6, horizontal: 16),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFE7ECFF) : Colors.white,
        border: Border.all(
          color: isSelected ? const Color(0xFF4C4BD9) : Colors.grey.shade300,
          width: 2,
        ),
        borderRadius: BorderRadius.circular(9999), // pill shape
      ),
      child: Row(
        children: [
          Icon(
            isSelected ? Icons.check_circle : Icons.circle_outlined,
            color: isSelected ? const Color(0xFF4C4BD9) : Colors.grey,
            size: 18*7/6,
          ),

          const SizedBox(width: 12),
          Text(
            text,
            style: TextStyle(
              fontSize: 16,
              color: isSelected ? const Color(0xFF4C4BD9) : Colors.black,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ),
  );
}
