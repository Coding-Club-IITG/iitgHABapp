import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/screens/leave_application_list_screen.dart';
import 'package:frontend2/utils/leave_pdf_download.dart';

/// Shown after a successful mess rebate application. No back stack to the form.
class RebateApplicationSuccessScreen extends StatelessWidget {
  const RebateApplicationSuccessScreen({
    super.key,
    this.leaveDocumentUrl = '',
    this.leaveTypeLabel = 'Leave Application',
  });

  final String leaveDocumentUrl;
  final String leaveTypeLabel;

  static const Color _borderColor = Color(0xFFE6E6E6);
  static const Color _greyBg = Color(0xFFF5F5F5);
  static const Color _titleColor = Color(0xFF2E2F31);
  static const Color _subtitleColor = Color(0xFF676767);
  static const Color _bodyText = Color(0xFF535353);
  static const Color _successRing = Color(0xFFEDF7F2);
  static const Color _successBg = Color(0xFFE2F2EB);
  static const Color _successGreen = Color(0xFF1F8441);
  static const Color _warningBg = Color(0xFFF9ECD2);
  static const Color _warningText = Color(0xFFA36500);
  static const Color _buttonShadow = Color(0x0D000000);

  Future<void> _downloadPdf(BuildContext context) async {
    await downloadAndShareLeavePdf(context, leaveDocumentUrl);
  }

  void _goHome(BuildContext context) {
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
        if (!didPop) _goHome(context);
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
            onPressed: () => _goHome(context),
          ),
          title: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Mess Rebate',
                style: TextStyle(
                  color: _titleColor,
                  fontWeight: FontWeight.w500,
                  fontSize: 20,
                  height: 28 / 20,
                ),
              ),
              Text(
                leaveTypeLabel,
                style: const TextStyle(
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
                      'Application Complete!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w500,
                        height: 32 / 24,
                        color: _successGreen,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Next Steps',
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
                      text: 'Download the E-generated Hostel Leave form.',
                    ),
                    const SizedBox(height: 4),
                    const _SuccessStep(
                      number: 2,
                      text: 'Take a printout of the document.',
                    ),
                    const SizedBox(height: 4),
                    const _SuccessStep(
                      number: 3,
                      text: 'Add the date and a valid signature.',
                    ),
                    const SizedBox(height: 4),
                    const _SuccessStep(
                      number: 4,
                      text: 'Submit it at the hostel security desk while leaving.',
                    ),
                    const SizedBox(height: 32),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _warningBg,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.error_outline_rounded,
                                size: 24,
                                color: _warningText,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Action required',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500,
                                  height: 24 / 16,
                                  color: _warningText,
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 8),
                          _ActionCallout(
                            text:
                                "Take a printout of the form and hand it at the hostel security desk. Your application won't be processed until this is done.",
                          ),
                          SizedBox(height: 8),
                          _ActionCallout(
                            text:
                                'Once the mess manager verifies it, the amount will be credited to your bank account',
                          ),
                        ],
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
              child: Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 52,
                      child: OutlinedButton(
                        onPressed: () => _goHome(context),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: Themes.kAccent,
                          side: const BorderSide(color: _borderColor),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          shadowColor: _buttonShadow,
                          elevation: 1,
                        ),
                        child: const Text(
                          'Go Home',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            height: 24 / 16,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: leaveDocumentUrl.isEmpty
                            ? null
                            : () => _downloadPdf(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Themes.kAccent,
                          disabledBackgroundColor:
                              Themes.kAccent.withValues(alpha: 0.45),
                          foregroundColor: Colors.white,
                          disabledForegroundColor: Colors.white,
                          surfaceTintColor: Colors.transparent,
                          elevation: 0,
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
                                Colors.white,
                                BlendMode.srcIn,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Flexible(
                              child: Text(
                                'Download',
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
                  ),
                ],
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
        color: RebateApplicationSuccessScreen._bodyText,
      ),
    );
  }
}

class _ActionCallout extends StatelessWidget {
  const _ActionCallout({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(left: 10),
      decoration: const BoxDecoration(
        border: Border(
          left: BorderSide(
            color: RebateApplicationSuccessScreen._warningText,
            width: 2,
          ),
        ),
      ),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          height: 20 / 14,
          color: RebateApplicationSuccessScreen._titleColor,
        ),
      ),
    );
  }
}
