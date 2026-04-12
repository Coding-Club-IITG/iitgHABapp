import 'package:flutter/material.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/leave_application_list_screen.dart';
import 'package:frontend2/utils/leave_pdf_download.dart';

/// Shown after a successful mess rebate application. No back stack to the form.
class RebateApplicationSuccessScreen extends StatelessWidget {
  const RebateApplicationSuccessScreen({
    super.key,
    required this.leaveDocumentUrl,
    required this.estimatedRebateAmountInr,
  });

  final String leaveDocumentUrl;
  final int estimatedRebateAmountInr;

  static const Color _borderColor = Color(0xFFE6E6E6);
  static const Color _greyBg = Color(0xFFF5F5F5);
  static const Color _subtitleMuted = Color(0xFF676767);
  static const Color _bodyText = Color(0xFF535353);
  static const Color _rebateMintBg = Color(0xFFE6F4EA);
  static const Color _successGreen = Color(0xFF1F8441);

  Future<void> _downloadPdf(BuildContext context) async {
    await downloadAndShareLeavePdf(context, leaveDocumentUrl);
  }

  void _goToRebate(BuildContext context) {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => const LeaveApplicationListScreen(),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _goToRebate(context);
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          automaticallyImplyLeading: false,
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Mess Rebate',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w500,
                  fontSize: 20,
                ),
              ),
              Text(
                'Application submitted',
                style: TextStyle(
                  fontSize: 12,
                  color: _subtitleMuted,
                ),
              ),
            ],
          ),
        ),
        body: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: const BoxDecoration(
                          color: _rebateMintBg,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          color: _successGreen,
                          size: 48,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Successfully applied',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: _borderColor),
                        borderRadius: const BorderRadius.all(Radius.circular(12)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Next steps (while leaving campus)',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.black,
                            ),
                          ),
                          SizedBox(height: 12),
                          Text(
                            '1. Download the e-generated hostel leave form.\n'
                            '2. Take a printout of the document.\n'
                            '3. Add the date and a valid signature.\n'
                            '4. Submit it at the hostel security desk while leaving.',
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.45,
                              color: _bodyText,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (leaveDocumentUrl.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => _downloadPdf(context),
                          icon: const Icon(Icons.download_rounded, size: 20),
                          label: const Text(
                            'Download e-generated hostel leave form (PDF)',
                            textAlign: TextAlign.center,
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Themes.kAccent,
                            side: const BorderSide(color: Themes.kAccent),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: _rebateMintBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _borderColor),
                      ),
                      child: Text(
                        'Please note that the generated document must be submitted at the hostel security desk '
                        'for the mess rebate application to be processed. Upon verification and acknowledgement by the mess manager, '
                        'a rebate amount of ₹$estimatedRebateAmountInr (calculated at ₹119 per day, multiplied by the number of applicable days) '
                        'will be transferred to the provided bank account.',
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.45,
                          color: Color(0xFF2E2F31),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                color: _greyBg,
                border: Border(
                  top: BorderSide(color: _borderColor),
                ),
              ),
              padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomInset),
              child: Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton(
                  onPressed: () => _goToRebate(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Themes.kAccent,
                    foregroundColor: Colors.white,
                    surfaceTintColor: Colors.transparent,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 28,
                      vertical: 14,
                    ),
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
