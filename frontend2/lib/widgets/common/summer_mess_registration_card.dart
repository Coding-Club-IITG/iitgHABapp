import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:frontend2/apis/summer_mess/summer_mess_api.dart';

class SummerMessRegistrationCard extends StatelessWidget {
  const SummerMessRegistrationCard({
    super.key,
    required this.status,
    required this.onTap,
  });

  final SummerMessStatusData status;
  final VoidCallback onTap;

  static const _surface = Color(0xFFFFFFFF);
  static const _border = Color(0xFFE6E6E6);
  static const _primary = Color(0xFF4C4EDB);
  static const _primarySoft = Color(0xFFEDEDFB);
  static const _textPrimary = Color(0xFF2E2F31);
  static const _textSecondary = Color(0xFF676767);
  static const _shadow = Color(0x14000000);

  String _formatDate(DateTime? value) {
    if (value == null) return 'soon';
    return DateFormat('d MMM').format(value.toLocal());
  }

  ({String title, String subtitle, Color iconBg, Color iconColor}) _copy() {
    if (status.isAcknowledged) {
      return (
        title: 'Summer Mess Approved',
        subtitle: status.summerActive
            ? 'Access enabled for ${status.application?.appliedHostelName ?? 'your selected hostel'}.'
            : 'Approved for the upcoming season at ${status.application?.appliedHostelName ?? 'your selected hostel'}.',
        iconBg: const Color(0xFFEDF7F2),
        iconColor: const Color(0xFF1F8441),
      );
    }
    if (status.isPending) {
      return (
        title: 'Summer Mess Pending',
        subtitle:
            'Waiting for acknowledgment from ${status.application?.appliedHostelName ?? 'the selected hostel'}.',
        iconBg: const Color(0xFFFFFAEB),
        iconColor: const Color(0xFFA36500),
      );
    }
    if (status.registrationOpen) {
      return (
        title: 'Summer Mess Registration',
        subtitle:
            'Registration is open until ${_formatDate(status.registrationEndAt)}.',
        iconBg: _primarySoft,
        iconColor: _primary,
      );
    }
    if (status.summerActive) {
      return (
        title: 'Summer Mess Active',
        subtitle: status.currentSubscriptionName.isEmpty
            ? 'You are not subscribed to any summer mess right now.'
            : 'Current summer access: ${status.currentSubscriptionName}.',
        iconBg: const Color(0xFFF5F5F5),
        iconColor: _textPrimary,
      );
    }
    return (
      title: 'Summer Mess',
      subtitle: 'Check registration details and application status.',
      iconBg: const Color(0xFFF5F5F5),
      iconColor: _textPrimary,
    );
  }

  @override
  Widget build(BuildContext context) {
    final copy = _copy();
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: _shadow,
            blurRadius: 6,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: copy.iconBg,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Icon(
                      Icons.wb_sunny_outlined,
                      size: 22,
                      color: copy.iconColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          copy.title,
                          style: const TextStyle(
                            fontSize: 16,
                            height: 24 / 16,
                            fontWeight: FontWeight.w500,
                            color: _textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          copy.subtitle,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 18 / 13,
                            fontWeight: FontWeight.w500,
                            color: _textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: _textSecondary,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
