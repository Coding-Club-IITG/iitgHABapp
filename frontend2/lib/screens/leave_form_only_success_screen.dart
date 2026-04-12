import 'package:flutter/material.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/leave_application_list_screen.dart';
import 'package:frontend2/utils/leave_pdf_download.dart';

/// After generating a station leave PDF without a mess rebate application.
class LeaveFormOnlySuccessScreen extends StatelessWidget {
  const LeaveFormOnlySuccessScreen({
    super.key,
    required this.leaveDocumentUrl,
  });

  final String leaveDocumentUrl;

  static const Color _borderColor = Color(0xFFE6E6E6);
  static const Color _greyBg = Color(0xFFF5F5F5);
  static const Color _bodyText = Color(0xFF535353);
  static const Color _successGreen = Color(0xFF1F8441);
  static const Color _successIconBg = Color(0xFFE6F4EA);

  Future<void> _downloadPdf(BuildContext context) async {
    await downloadAndShareLeavePdf(context, leaveDocumentUrl);
  }

  void _goToRebateHub(BuildContext context) {
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
        if (!didPop) _goToRebateHub(context);
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          centerTitle: false,
          titleSpacing: NavigationToolbar.kMiddleSpacing,
          automaticallyImplyLeading: false,
          title: const Text(
            'Generate leave form',
            style: TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.w500,
              fontSize: 20,
            ),
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
                          color: _successIconBg,
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
                      'Your leave form is ready',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'This was not saved as a mess rebate application. No bank or proof was submitted.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        color: Colors.grey[800],
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
                            'Next steps',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.black,
                            ),
                          ),
                          SizedBox(height: 12),
                          Text(
                            '1. Download the e-generated hostel leave form below.\n'
                            '2. Print the document.\n'
                            '3. Add the date and your signature.\n'
                            '4. Submit it at the hostel security desk when leaving.',
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
                            'Download hostel leave form (PDF)',
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
                  onPressed: () => _goToRebateHub(context),
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
