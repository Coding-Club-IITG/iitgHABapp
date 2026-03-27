import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/widgets/common/mess_dropdowns.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/endpoint.dart';
import '../widgets/microsoft_required_dialog.dart';

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
        leading: const BackButton(),
      ),
      body: SafeArea(
        child: loadingStatus
            ? const Center(child: CircularProgressIndicator())
            : Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                child: ListView(
                  children: [
                    const Text(
                      "Mess Preference",
                      style: TextStyle(
                        fontFamily: 'OpenSans_Bold',
                        color: Themes.feedbackColor,
                        fontSize: 32,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 32),

                    const Text(
                      'Choose the mess that suits your taste or convenience.',
                      style: TextStyle(
                        fontWeight: FontWeight.w500,
                        fontSize: 20,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Mess change instructions
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Color(0xFFE8F0FE),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Mess Change Instructions:',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Color(0xFF1A237E),
                            ),
                          ),
                          SizedBox(height: 8),
                          Text(
                            '1. If you have already changed your mess, your mess will automatically reset to your boarding hostel after this month. To continue with your current mess, you must apply again next month.',
                            style:
                                TextStyle(fontSize: 14, color: Colors.black87),
                          ),
                          SizedBox(height: 6),
                          Text(
                            '2. You cannot apply for a mess change to your own boarding hostel. However, you may apply to a hostel where you are a mess subscriber.',
                            style:
                                TextStyle(fontSize: 14, color: Colors.black87),
                          ),
                          SizedBox(height: 6),
                          Text(
                            "3. Once you apply for a mess change, it cannot be cancelled.",
                            style:
                                TextStyle(fontSize: 14, color: Colors.black87),
                          ),
                        ],
                      ),
                    ),

                    // Info banner if user is SMC
                    if (isSMC)
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.red[100],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'SMC members are not allowed to apply for mess change',
                          style: TextStyle(color: Colors.red),
                        ),
                      ),

                    // Info banner if already applied
                    if (alreadyApplied)
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.yellow[100],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          appliedHostel != null && appliedHostel!.isNotEmpty
                              ? 'You have already applied for $appliedHostel'
                              : 'You have already applied',
                          style: const TextStyle(color: Colors.black87),
                        ),
                      ),

                    const SizedBox(height: 24),
                    // Replaced single 'Preferences' heading with labels per dropdown

                    // 1st Preference
                    const Text(
                      '1st Preference',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
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
                        fontWeight: FontWeight.w500,
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
                        fontWeight: FontWeight.w500,
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

                    // Red info text when mess change is disabled
                    if (isMessChangeEnabled == false)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8.0),
                        child: Text(
                          'Mess change is currently disabled, you will be notified when it opens.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFFC40205),
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
                                color: Color(0xFFC40205),
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
                    (loadingStatus) ? Colors.grey : const Color(0xFF4C4EDB),
                  ),
                  elevation: WidgetStateProperty.all(0),
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
