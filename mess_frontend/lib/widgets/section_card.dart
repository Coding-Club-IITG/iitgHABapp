import 'package:flutter/material.dart';

import '../models/section_data.dart';
import '../utils/scan_time.dart';

class SectionCard extends StatelessWidget {
  final SectionData section;

  const SectionCard({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.label,
            style: const TextStyle(
              color: Color(0xFF111827),
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          if (section.entries.isEmpty)
            Text(
              section.emptyText,
              style: const TextStyle(
                color: Color(0xFF6B7280),
                fontSize: 13,
              ),
            )
          else
            Column(
              children: section.entries.map((e) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.name.isEmpty ? 'Unknown' : e.name,
                              style: const TextStyle(
                                color: Color(0xFF111827),
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (e.rollNumber.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  e.rollNumber,
                                  style: const TextStyle(
                                    color: Color(0xFF6B7280),
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatScanTime(e.time),
                        style: const TextStyle(
                          color: Color(0xFF4C4EDB),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}
