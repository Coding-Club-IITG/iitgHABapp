import 'package:flutter/material.dart';

import '../models/recent_entry.dart';
import '../utils/scan_time.dart';

class RecentScanCard extends StatelessWidget {
  final RecentEntry entry;
  final int? index;
  final bool showIndex;

  const RecentScanCard({
    super.key,
    required this.entry,
    this.index,
    this.showIndex = false,
  });

  @override
  Widget build(BuildContext context) {
    final displayName =
        entry.name.isEmpty ? 'Unknown' : entry.name.trim();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          if (showIndex && index != null) ...[
            Text(
              '${index!}.',
              style: const TextStyle(
                color: Color(0xFF6B7280),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              displayName,
              style: const TextStyle(
                color: Color(0xFF111827),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatScanTime(entry.time),
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
