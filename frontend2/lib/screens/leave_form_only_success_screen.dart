import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
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
  static const Color _titleColor = Color(0xFF2E2F31);
  static const Color _subtitleColor = Color(0xFF676767);
  static const Color _bodyText = Color(0xFF535353);
  static const Color _successRing = Color(0xFFEDF7F2);
  static const Color _successBg = Color(0xFFE2F2EB);
  static const Color _successGreen = Color(0xFF1F8441);

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
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: _titleColor),
            onPressed: () => _goToRebateHub(context),
          ),
          title: const Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Generate leave form',
                style: TextStyle(
                  color: _titleColor,
                  fontWeight: FontWeight.w500,
                  fontSize: 20,
                  height: 28 / 20,
                ),
              ),
              Text(
                'Leave form only',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  height: 16 / 12,
                  color: _subtitleColor,
                ),
              ),
            ],
          ),
        ),
        body: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 22, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 96,
                        height: 96,
                        decoration: const BoxDecoration(
                          color: _successBg,
                          shape: BoxShape.circle,
                          border: Border.fromBorderSide(
                            BorderSide(
                              color: _successRing,
                              width: 17.143,
                            ),
                          ),
                        ),
                        child: const Icon(
                          Icons.check_circle_outline_rounded,
                          color: _successGreen,
                          size: 48,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Your leave form is ready',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w500,
                        height: 32 / 24,
                        color: _successGreen,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'This was not saved as a mess rebate application. No bank or proof was submitted.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        height: 18 / 13,
                        color: _bodyText,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Next steps',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        height: 20 / 16,
                        color: _titleColor,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const _SuccessStep(
                      number: 1,
                      text: 'Download the e-generated hostel leave form below.',
                    ),
                    const SizedBox(height: 4),
                    const _SuccessStep(
                      number: 2,
                      text: 'Print the document.',
                    ),
                    const SizedBox(height: 4),
                    const _SuccessStep(
                      number: 3,
                      text: 'Add the date and your signature.',
                    ),
                    const SizedBox(height: 4),
                    const _SuccessStep(
                      number: 4,
                      text: 'Submit it at the hostel security desk when leaving.',
                    ),
                    if (leaveDocumentUrl.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: OutlinedButton(
                          onPressed: () => _downloadPdf(context),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Themes.kAccent,
                            backgroundColor: Colors.white,
                            side: const BorderSide(color: _borderColor),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SvgPicture.asset(
                                'assets/icon/download-2-line.svg',
                                width: 20,
                                height: 20,
                                colorFilter: const ColorFilter.mode(
                                  Themes.kAccent,
                                  BlendMode.srcIn,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Flexible(
                                child: Text(
                                  'Download hostel leave form (PDF)',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  softWrap: false,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                    height: 24 / 16,
                                  ),
                                ),
                              ),
                            ],
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
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () => _goToRebateHub(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Themes.kAccent,
                    foregroundColor: Colors.white,
                    surfaceTintColor: Colors.transparent,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      height: 24 / 16,
                    ),
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

class _SuccessStep extends StatelessWidget {
  const _SuccessStep({
    required this.number,
    required this.text,
  });

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$number. $text',
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 18 / 12,
        color: LeaveFormOnlySuccessScreen._bodyText,
      ),
    );
  }
}
