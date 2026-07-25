import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:frontend2/apis/summer_mess/summer_mess_api.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/utils/leave_pdf_download.dart';

// Theme tokens
abstract final class _Ui {
  static const Color primary = Color(0xFF4C4EDB);
  static const Color primaryBg = Color(0xFFEDEDFB);
  static const Color primaryBorder = Color(0xFFB9B9F4);
  static const Color border = Color(0xFFE6E6E6);
  static const Color grey1 = Color(0xFF535353);
  static const Color grey2 = Color(0xFF2E2F31);
  static const Color dividerBar = Color(0xFFF0F0F0);
  static const Color footerBg = Color(0xFFF5F5F5);
  static const Color cancelBg = Color(0xFFFEF6F6);
  static const Color semanticRed = Color(0xFFC40205);
}

// Main screen

class SummerMessApplicationStatusScreen extends StatelessWidget {
  const SummerMessApplicationStatusScreen({
    super.key,
    required this.status,
    required this.onCancel,
    this.onDelete,
  });

  final SummerMessStatusData status;
  final Future<void> Function() onCancel;
  final Future<void> Function()? onDelete;

  // Formatters

  String _ordinalDay(int d) {
    if (d >= 11 && d <= 13) return '${d}th';
    switch (d % 10) {
      case 1:
        return '${d}st';
      case 2:
        return '${d}nd';
      case 3:
        return '${d}rd';
      default:
        return '${d}th';
    }
  }

  String _formatDateTime(DateTime? value) {
    if (value == null) return '';
    final dt = value.toLocal();
    final month = DateFormat('MMMM').format(dt);
    final time = DateFormat('h:mm a').format(dt);
    return '${_ordinalDay(dt.day)} $month $time';
  }

  String _formatDateOnly(DateTime? value) {
    if (value == null) return '';
    return DateFormat('d MMM yyyy').format(value.toLocal());
  }

  // Payment proof helpers

  String _paymentProofFileName(SummerMessApplicationData application) {
    final filename =
        (application.paymentProofFilename as String?)?.trim() ?? '';
    if (filename.isNotEmpty) return filename;
    final url = (application.paymentProofUrl as String?)?.trim() ?? '';
    if (url.isNotEmpty) {
      final uri = Uri.tryParse(url);
      final segment =
          uri?.pathSegments.isNotEmpty == true ? uri!.pathSegments.last : '';
      if (segment.isNotEmpty) return segment;
    }
    return 'summer-mess-payment-proof.pdf';
  }

  String _paymentProofMimeType(SummerMessApplicationData application) {
    final lower = _paymentProofFileName(application).toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/pdf';
  }

  Future<void> _viewUploadedPaymentProof(
    BuildContext context,
    SummerMessApplicationData application,
  ) async {
    // Prefer fetching via server proxy to avoid OneDrive org-link 403/expired issues
    final token = await getAccessToken();
    if (token == 'error') {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Session expired. Please sign in again.')),
        );
      }
      return;
    }

    final url = SummerMessEndpoints.myApplicationProofDocument(application.id);
    final name = _paymentProofFileName(application);
    final mime = _paymentProofMimeType(application);

    await downloadAndShareDocumentFromUrl(
      context,
      url,
      fileName: name,
      mimeType: mime,
      shareSubject: 'Summer mess payment proof',
      emptyDownloadMessage: 'Could not download payment proof.',
      requestHeaders: {'Authorization': 'Bearer $token'},
    );
  }

  Widget _buildPaymentProofWidget(
    BuildContext context,
    SummerMessApplicationData application,
  ) {
    if (application.paymentProofUploaded) {
      return _BrandOutlineButton(
        onPressed: () => _viewUploadedPaymentProof(context, application),
        icon: Icons.visibility_outlined,
        label: 'View uploaded proof',
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _Ui.border),
      ),
      child: const Text(
        'No proof uploaded',
        style: TextStyle(
          fontSize: 13,
          color: _Ui.grey1,
          height: 1.35,
        ),
      ),
    );
  }

  // Timeline card

  Widget _buildTimelineCard(SummerMessApplicationData application) {
    final appliedAt = application.appliedAt;
    final acknowledgedAt = application.acknowledgedAt;
    final statusLower = application.status.toLowerCase().trim();
    final step2Done = statusLower == 'acknowledged';

    final steps = [
      _TimelineStepVm(
        kind: _DotKind.complete,
        title: 'Registration Successful',
        subtitle: _formatDateTime(appliedAt),
      ),
      _TimelineStepVm(
        kind: step2Done ? _DotKind.complete : _DotKind.active,
        title: step2Done
            ? 'Verified By Mess Manager'
            : 'Pending Verification by Mess Manager',
        subtitle: _formatDateTime(acknowledgedAt),
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _Ui.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 16,
            offset: Offset(0, 0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            status.seasonLabel.isEmpty ? 'Summer mess' : status.seasonLabel,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 20 / 14,
              color: _Ui.grey1,
            ),
          ),
          const SizedBox(height: 16),
          ...List.generate(steps.length, (index) {
            final step = steps[index];
            final last = index == steps.length - 1;
            final lineBlue = !last && step.kind == _DotKind.complete;
            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 32,
                    child: Column(
                      children: [
                        Center(child: _TimelineDot(kind: step.kind)),
                        if (!last)
                          Expanded(
                            child: Align(
                              alignment: Alignment.topCenter,
                              child: Container(
                                width: 2,
                                color: lineBlue ? _Ui.primary : _Ui.border,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: last ? 0 : 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            step.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              height: 24 / 16,
                              color: _Ui.grey2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          SizedBox(
                            height: 18,
                            child: Align(
                              alignment: Alignment.topLeft,
                              child: (step.subtitle == null ||
                                      step.subtitle!.isEmpty)
                                  ? const SizedBox.shrink()
                                  : Text(
                                      step.subtitle!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w400,
                                        height: 18 / 12,
                                        color: _Ui.grey2,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          // Contextual explanatory message below the timeline dots
          Builder(builder: (context) {
            final statusLower = application.status.toLowerCase().trim();
            final isPending = statusLower == 'pending';
            final isAcknowledged = statusLower == 'acknowledged';
            final summerActive = status.summerActive == true;
            final hostelName = application.appliedHostelName;
            final startDate = status.summerStartAt;
            final endDate = status.summerEndAt;

            if (isPending) {
              return const Text(
                'Your application is at the mess manager for verification. If it is taking more time than expected please visit the mess manager during mess hours.',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: _Ui.grey1,
                ),
              );
            }

            if (isAcknowledged && !summerActive) {
              return Text(
                'You will be able to have meals in $hostelName hostel mess from ${_formatDateOnly(startDate)} till ${_formatDateOnly(endDate)}.',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: _Ui.grey1,
                ),
              );
            }

            if (isAcknowledged && summerActive) {
              return Text(
                'Your application is verified by the mess manager. You are eligible to have meals in $hostelName hostel mess till ${_formatDateOnly(endDate)}.',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: _Ui.grey1,
                ),
              );
            }

            return const SizedBox.shrink();
          }),
        ],
      ),
    );
  }

  // ── Cancel footer ────────────────────────────────────────────────────────

  Widget _buildCancelFooter(BuildContext context, {required bool canCancel}) {
    if (!canCancel) return const SizedBox.shrink();
    return Material(
      color: _Ui.footerBg,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: _Ui.footerBg,
          border: Border(top: BorderSide(color: _Ui.border)),
        ),
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          16 + MediaQuery.paddingOf(context).bottom,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: _Ui.cancelBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _Ui.semanticRed),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D000000),
                offset: Offset(0, 1),
                blurRadius: 4,
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () async => onCancel(),
              borderRadius: BorderRadius.circular(8),
              child: const SizedBox(
                height: 52,
                child: Center(
                  child: Text(
                    'Cancel application',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      height: 24 / 16,
                      color: _Ui.semanticRed,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDeleteFooter(BuildContext context, {required bool canDelete}) {
    if (!canDelete) return const SizedBox.shrink();
    return Material(
      color: _Ui.footerBg,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: _Ui.footerBg,
          border: Border(top: BorderSide(color: _Ui.border)),
        ),
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          16 + MediaQuery.paddingOf(context).bottom,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: _Ui.cancelBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _Ui.semanticRed),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D000000),
                offset: Offset(0, 1),
                blurRadius: 4,
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onDelete == null ? null : () async => await onDelete!(),
              borderRadius: BorderRadius.circular(8),
              child: const SizedBox(
                height: 52,
                child: Center(
                  child: Text(
                    'Delete summer subscription',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      height: 24 / 16,
                      color: _Ui.semanticRed,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // build

  @override
  Widget build(BuildContext context) {
    final application = status.application;
    if (application == null) return const SizedBox.shrink();

    final canCancel = application.canCancel;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {},
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: _buildTimelineCard(application),
                  ),
                  const SizedBox(height: 16),
                  Container(height: 8, color: _Ui.dividerBar),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                    child: _SectionBlock(
                      title: 'Application Details',
                      subtitle: 'Summary of your summer mess registration.',
                      trailing: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _DetailRow(
                            label: 'Preferred Hostel',
                            value: application.appliedHostelName,
                          ),
                          const _DividerRow(),
                          _DetailRow(
                            label: 'Phase Start Date',
                            value: _formatDateOnly(status.summerStartAt),
                          ),
                          const _DividerRow(),
                          _DetailRow(
                            label: 'Phase End Date',
                            value: _formatDateOnly(status.summerEndAt),
                          ),
                          const _DividerRow(),
                          _DetailRow(
                            label: 'Total Amount',
                            value:
                                'Rs ${application.totalAmount.toStringAsFixed(0)}',
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),
                  Container(height: 8, color: _Ui.dividerBar),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                    child: _SectionBlock(
                      title: 'Payment Proof',
                      subtitle: application.paymentProofUploaded
                          ? 'Your uploaded payment proof document.'
                          : 'No payment proof has been uploaded.',
                      trailing: _buildPaymentProofWidget(
                        context,
                        application,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        _buildDeleteFooter(context,
            canDelete: status.summerActive &&
                status.currentSubscriptionName.isNotEmpty),
        _buildCancelFooter(context, canCancel: canCancel),
      ],
    );
  }
}

// Section block (mirrors rebate screen)

class _SectionBlock extends StatelessWidget {
  const _SectionBlock({
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  height: 20 / 16,
                  color: _Ui.grey2,
                ),
              ),
            ),
            // no title suffix for this simplified layout
          ],
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w400,
            height: 18 / 12,
            color: _Ui.grey1,
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(height: 8),
          trailing!,
        ],
      ],
    );
  }
}

// Detail row + divider

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w400,
                color: _Ui.grey1,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: _Ui.grey2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DividerRow extends StatelessWidget {
  const _DividerRow();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 12),
      child: Divider(height: 1, color: _Ui.border),
    );
  }
}

// Shared sub-widgets

enum _DotKind { complete, active, incomplete }

class _TimelineStepVm {
  const _TimelineStepVm({
    required this.kind,
    required this.title,
    this.subtitle,
  });

  final _DotKind kind;
  final String title;
  final String? subtitle;
}

class _TimelineDot extends StatelessWidget {
  const _TimelineDot({required this.kind});

  final _DotKind kind;

  @override
  Widget build(BuildContext context) {
    switch (kind) {
      case _DotKind.complete:
        return Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            color: _Ui.primary,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, size: 14, color: Colors.white),
        );
      case _DotKind.active:
        return Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: _Ui.primaryBg,
            shape: BoxShape.circle,
          ),
          child: Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: _Ui.primary,
              shape: BoxShape.circle,
            ),
          ),
        );
      case _DotKind.incomplete:
        return Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: _Ui.grey1),
          ),
        );
    }
  }
}

class _BrandOutlineButton extends StatelessWidget {
  const _BrandOutlineButton({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback onPressed;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: _Ui.primary,
        backgroundColor: _Ui.primaryBg,
        side: const BorderSide(color: _Ui.primaryBorder),
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 20 / 14,
            ),
          ),
        ],
      ),
    );
  }
}
