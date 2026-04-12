import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/widgets/common/mess_dropdowns.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/endpoint.dart';
import '../widgets/microsoft_required_dialog.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';

/// Same palette rhythm as [MessScreen] / leave flows — no Material blue / raw red fills.
abstract final class _MessPrefTheme {
  static const primary = Color(0xFF4C4EDB);
  static const border = Color(0xFFE6E6E6);
  static const textPrimary = Color(0xFF2E2F31);
  static const textSecondary = Color(0xFF676767);
  static const neutralNoticeBg = Color(0xFFF5F5F5);
}

class MessChangePreferenceScreen extends StatefulWidget {
  const MessChangePreferenceScreen({super.key});

  @override
  State<MessChangePreferenceScreen> createState() =>
      _MessChangePreferenceScreenState();
}

class _MessChangePreferenceScreenState
    extends State<MessChangePreferenceScreen> {
  bool first = true;
  String? firstpref;
  String? secondpref;
  String? thirdpref;
  bool alreadyApplied = false;
  String? appliedHostel;
  String? defaultMess; // Now represents current hostel
  bool? isMessChangeEnabled;
  bool isSMC = false; // Track if user is SMC

  bool loadingStatus = true; // track API loading state

  final dio = DioClient().dio;

  @override
  void initState() {
    super.initState();
    _checkMicrosoftLink();
    checkMessChangeStatus();
    checkSMCStatus();
  }

  Future<void> _checkMicrosoftLink() async {
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
    final guestIdentifier = prefs.getString('guestIdentifier');

    // Don't show link account dialog for guest users - show message instead
    // Check: guestIdentifier exists AND Microsoft not linked = active guest user
    if (guestIdentifier != null && !hasMicrosoftLinked) {
      if (mounted) {
        Navigator.pop(context);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Center(
                  child: Text(
                    'Mess Change is not available for guest users. Please sign in with a student account to access this feature.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white),
                  ),
                ),
                backgroundColor: Colors.black,
                behavior: SnackBarBehavior.floating,
                margin: EdgeInsets.all(50),
                duration: Duration(seconds: 4),
              ),
            );
          }
        });
      }
      return;
    }

    if (!hasMicrosoftLinked && mounted) {
      // Show dialog to link Microsoft account
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          showDialog(
            context: context,
            builder: (context) => const MicrosoftRequiredDialog(
              featureName: 'Mess Change',
            ),
          );
          // Navigate back
          Navigator.pop(context);
        }
      });
      return;
    }
  }

  Future<void> checkSMCStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        isSMC = prefs.getBool('isSMC') ?? false;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('Error checking SMC status: $e');
    }
  }

  /// Helper to show dialogs and refresh after user presses OK
  Future<void> _showMessage(String title, String message,
      {bool refreshAfter = false}) async {
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // close dialog
            },
            child: const Text("OK"),
          ),
        ],
      ),
    );

    if (refreshAfter && mounted) {
      await checkMessChangeStatus(); // 🔄 refresh after dialog OK
    }
  }

  static const List<String> _messChangeRuleBodies = [
    'If you have already changed your mess, your mess will automatically reset to your boarding hostel after this month. To continue with your current mess, you must apply again next month.',
    'You cannot apply for a mess change to your own boarding hostel. However, you may apply to a hostel where you are a mess subscriber.',
    'Once you apply for a mess change, it cannot be cancelled.',
  ];

  void _showMessChangeRulesSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final bottom = MediaQuery.paddingOf(ctx).bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 16 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: const BoxDecoration(
                    color: Color(0xFFE0E0E0),
                    borderRadius: BorderRadius.all(Radius.circular(999)),
                  ),
                ),
              ),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Mess change rules',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        height: 24 / 18,
                        color: _MessPrefTheme.textPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close),
                    color: _MessPrefTheme.textSecondary,
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(ctx).height * 0.5,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < _messChangeRuleBodies.length; i++) ...[
                        if (i > 0) const SizedBox(height: 14),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 22,
                              child: Text(
                                '${i + 1}.',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  height: 20 / 14,
                                  color: _MessPrefTheme.textSecondary,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                _messChangeRuleBodies[i],
                                style: const TextStyle(
                                  fontSize: 14,
                                  height: 20 / 14,
                                  fontWeight: FontWeight.w400,
                                  color: _MessPrefTheme.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(ctx),
                style: FilledButton.styleFrom(
                  backgroundColor: _MessPrefTheme.textPrimary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Got it',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> checkMessChangeStatus() async {
    setState(() => loadingStatus = true);

    try {
      final dio = DioClient().dio;
      final token = await getAccessToken();

      final res = await dio.get(
        MessChange.messChangeStatus,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        ),
      );

      if (res.statusCode == 200) {
        final prefs = res.data['preferences'];
        final appliedList = (res.data['appliedHostels'] as List?)
                ?.whereType<String>()
                .toList() ??
            [];
        setState(() {
          alreadyApplied = res.data['applied'] ?? false;
          appliedHostel = appliedList.isNotEmpty
              ? appliedList.join(', ')
              : res.data['hostel'];
          defaultMess = res.data['default'];
          isMessChangeEnabled = res.data['isMessChangeEnabled'];
          // prefill dropdowns with server values when available
          firstpref = prefs != null ? (prefs['first'] as String?) : null;
          secondpref = prefs != null ? (prefs['second'] as String?) : null;
          thirdpref = prefs != null ? (prefs['third'] as String?) : null;
          first = true;
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Error fetching mess change status: $e');
      _showMessage("Error", "Unable to fetch mess change status.");
    } finally {
      if (mounted) setState(() => loadingStatus = false);
    }
  }

  Future<void> handleSubmit(String? firstpref) async {
    // Check if user is SMC
    if (isSMC) {
      _showMessage(
          "Error", "SMC members are not allowed to apply for mess change");
      return;
    }

    // First preference mandatory; second and third optional
    if (firstpref == null) {
      _showMessage("Error", "Please select your first mess preference");
      return;
    }

    // Collect provided (non-null) preferences
    final provided =
        [firstpref, secondpref, thirdpref].whereType<String>().toList();

    // Ensure uniqueness among provided preferences
    if (provided.toSet().length != provided.length) {
      _showMessage("Error", "Preferences must be unique");
      return;
    }

    // Ensure none of the provided preferences equals current hostel
    if (defaultMess != null && provided.contains(defaultMess)) {
      _showMessage(
          "Error", "Please select hostels different from your current hostel");
      return;
    }

    try {
      final token = await getAccessToken();
      String url = MessChange.messChangeRequest;

      final res = await dio.post(
        url,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
        data: {
          "mess_pref_1": firstpref,
          "mess_pref_2": secondpref,
          "mess_pref_3": thirdpref,
        },
      );

      if (res.statusCode == 202) {
        _showMessage(
          "Mess Change Rejected",
          "Mess change is only permitted between 24th and 27th of each month.",
          refreshAfter: true,
        );
      } else if (res.statusCode == 200) {
        _showMessage(
          "Success",
          "Form submitted successfully!",
          refreshAfter: true,
        );
      } else {
        _showMessage(
          "Error",
          "Form couldn't be submitted. Try again later!",
          refreshAfter: true,
        );
      }
    } catch (e) {
      if (e is DioException) {
        if (kDebugMode) debugPrint('Error submitting mess change: $e');
        _showMessage(
          "Error",
          "${e.response?.data['message'] ?? "We couldn't process your request!"}",
          refreshAfter: true,
        );
      } else {
        if (kDebugMode) debugPrint('Error submitting mess change: $e');
        _showMessage(
          "Error",
          "We couldn't process your request!",
          refreshAfter: true,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        foregroundColor: _MessPrefTheme.textPrimary,
        leading: const BackButton(color: _MessPrefTheme.textPrimary),
        actions: [
          IconButton(
            tooltip: 'Mess change rules',
            onPressed: _showMessChangeRulesSheet,
            icon: const Icon(Icons.info_outline),
            color: _MessPrefTheme.textSecondary,
          ),
        ],
      ),
      body: SafeArea(
        child: loadingStatus
            ? ShimmerHost(
                builder: (context, box) => Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 0),
                  child: ListView(
                    children: [
                      box(height: 36, width: 220),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        child: box(
                          height: 22,
                          width: double.infinity,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: box(
                          height: 18,
                          width: double.infinity,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      const SizedBox(height: 28),
                      for (int i = 0; i < 6; i++) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: box(
                            height: 56,
                            width: double.infinity,
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              )
            : Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                child: ListView(
                  children: [
                    const Text(
                      'Mess Preference',
                      style: TextStyle(
                        color: _MessPrefTheme.textPrimary,
                        fontSize: 32,
                        height: 48 / 32,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 32),

                    const Text(
                      'Choose the mess that suits your taste or convenience.',
                      style: TextStyle(
                        fontWeight: FontWeight.w500,
                        fontSize: 20,
                        height: 28 / 20,
                        color: _MessPrefTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Info banner if user is SMC
                    if (isSMC) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: _MessPrefTheme.neutralNoticeBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _MessPrefTheme.border),
                        ),
                        child: const Text(
                          'SMC members are not allowed to apply for mess change',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            height: 20 / 14,
                            fontWeight: FontWeight.w500,
                            color: _MessPrefTheme.textPrimary,
                          ),
                        ),
                      ),
                    ],

                    // Info banner if already applied
                    if (alreadyApplied)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: _MessPrefTheme.neutralNoticeBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _MessPrefTheme.border),
                        ),
                        child: Text(
                          appliedHostel != null && appliedHostel!.isNotEmpty
                              ? 'You have already applied for $appliedHostel'
                              : 'You have already applied',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 14,
                            height: 20 / 14,
                            fontWeight: FontWeight.w500,
                            color: _MessPrefTheme.textPrimary,
                          ),
                        ),
                      ),

                    const SizedBox(height: 24),
                    // Replaced single 'Preferences' heading with labels per dropdown

                    // 1st Preference
                    const Text(
                      '1st Preference',
                      style: TextStyle(
                        fontSize: 16,
                        height: 24 / 16,
                        fontWeight: FontWeight.w500,
                        color: _MessPrefTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    MessDropdown(
                      selectedOption: firstpref,
                      enabled: (isMessChangeEnabled == true) &&
                          !alreadyApplied &&
                          !isSMC,
                      onChanged: (isMessChangeEnabled == true) &&
                              !alreadyApplied &&
                              !isSMC
                          ? (value) => setState(() {
                                firstpref = value;
                              })
                          : null,
                    ),

                    const SizedBox(height: 12),

                    // 2nd Preference (Optional)
                    const Text(
                      '2nd Preference (Optional)',
                      style: TextStyle(
                        fontSize: 16,
                        height: 24 / 16,
                        fontWeight: FontWeight.w500,
                        color: _MessPrefTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    MessDropdown(
                      selectedOption: secondpref,
                      enabled: (isMessChangeEnabled == true) &&
                          !alreadyApplied &&
                          !isSMC,
                      onChanged: (isMessChangeEnabled == true) &&
                              !alreadyApplied &&
                              !isSMC
                          ? (value) => setState(() {
                                secondpref = value;
                              })
                          : null,
                    ),

                    const SizedBox(height: 12),

                    // 3rd Preference (Optional)
                    const Text(
                      '3rd Preference (Optional)',
                      style: TextStyle(
                        fontSize: 16,
                        height: 24 / 16,
                        fontWeight: FontWeight.w500,
                        color: _MessPrefTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    MessDropdown(
                      selectedOption: thirdpref,
                      enabled: (isMessChangeEnabled == true) &&
                          !alreadyApplied &&
                          !isSMC,
                      onChanged: (isMessChangeEnabled == true) &&
                              !alreadyApplied &&
                              !isSMC
                          ? (value) => setState(() {
                                thirdpref = value;
                              })
                          : null,
                    ),

                    if (isMessChangeEnabled == false)
                      Padding(
                        padding: const EdgeInsets.only(top: 8, bottom: 4),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: _MessPrefTheme.neutralNoticeBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _MessPrefTheme.border),
                          ),
                          child: const Text(
                            'Mess change is currently disabled, you will be notified when it opens.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w500,
                              color: _MessPrefTheme.textPrimary,
                            ),
                          ),
                        ),
                      ),

                    if (firstpref == null && !first)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: Row(
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(12, 0, 8, 0),
                              child: SvgPicture.asset(
                                'assets/icon/information-line.svg',
                                height: 16,
                                width: 16,
                              ),
                            ),
                            const Text(
                              'Fill this Section',
                              style: TextStyle(
                                fontSize: 12,
                                height: 16 / 12,
                                fontWeight: FontWeight.w500,
                                color: _MessPrefTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        height: ((isMessChangeEnabled == true) && !alreadyApplied && !isSMC)
            ? 85
            : 16,
        decoration: const BoxDecoration(
            //border: Border(top: BorderSide(width: 1, color: Color(0xFFE5E5E5))),
            ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if ((isMessChangeEnabled == true) && !alreadyApplied && !isSMC)
              ElevatedButton(
                onPressed: (loadingStatus)
                    ? null
                    : () {
                        handleSubmit(firstpref);
                        setState(() => first = false);
                      },
                style: ButtonStyle(
                  backgroundColor: WidgetStateProperty.all(
                    (loadingStatus)
                        ? Colors.grey
                        : _MessPrefTheme.primary,
                  ),
                  elevation: WidgetStateProperty.all(0),
                  shape: WidgetStateProperty.all(
                    RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                child: const Text(
                  'Submit',
                  style: TextStyle(fontSize: 16, color: Colors.white),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
