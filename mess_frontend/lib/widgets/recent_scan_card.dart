import 'package:flutter/material.dart';

import '../constants/themes.dart';
import '../models/recent_entry.dart';
import '../utils/name_case.dart';
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
    final displayName = entry.name.isEmpty
        ? 'Unknown'
        : toTitleCase(entry.name);

    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            if (showIndex && index != null) ...[
              Text(
                '${index!}.',
                style: const TextStyle(
                  color: Themes.textSecondary,
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
                  color: Themes.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              formatScanTime(entry.time),
              style: const TextStyle(
                color: Themes.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
