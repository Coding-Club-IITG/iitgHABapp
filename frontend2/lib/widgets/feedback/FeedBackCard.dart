// ignore_for_file: file_names

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../constants/endpoint.dart';
import '../../screens/mess_feedback/mess_feedback_page.dart';
import '../../utilities/notifications.dart';
import '../../widgets/microsoft_required_dialog.dart';

class FeedbackCard extends StatefulWidget {
  const FeedbackCard({super.key});

  @override
  State<FeedbackCard> createState() => _FeedbackCardState();
}

class _FeedbackCardState extends State<FeedbackCard> {
  bool _submitted = false;
  bool _windowOpen = false;
  bool _loading = true;
  String _windowTimeLeft = '';
  int _refreshVersion = 0;

  @override
  void initState() {
    super.initState();
    _refreshCardData();

    // Listen to feedback refresh notifier
    feedbackRefreshNotifier.addListener(_onRefreshNotified);
  }

  void _onRefreshNotified() {
    if (kDebugMode) debugPrint("🔄 FeedbackCard refresh triggered");
    _refreshCardData();
  }

  @override
  void dispose() {
    feedbackRefreshNotifier.removeListener(_onRefreshNotified);
    super.dispose();
  }

  Future<void> _refreshCardData() async {
    final int requestVersion = ++_refreshVersion;

    if (mounted) {
      setState(() {
        _loading = true;
      });
    }

    try {
      final dio = DioClient().dio;
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      final responses = await Future.wait([
        dio.get(MessFeedback.feedbackSettings),
        dio.get(MessFeedback.windowTimeLeft),
      ]);

      if (!mounted || requestVersion != _refreshVersion) return;

      final settingsRes = responses[0];
      final windowTimeRes = responses[1];
      final windowOpen = settingsRes.data['isEnabled'] == true;
      final formattedTime =
          (windowTimeRes.data != null && windowTimeRes.data['formatted'] != null)
              ? windowTimeRes.data['formatted'].toString()
              : '';

      bool submitted = false;

      if (windowOpen && token != null) {
        if (kDebugMode) debugPrint("FEEDBACK: Open");
        if (kDebugMode) debugPrint("FEEDBACK: Checking submission status");
        final submittedRes = await dio.get(
          MessFeedback.feedbackSubmitted,
          options: Options(
            headers: {"Authorization": "Bearer $token"},
          ),
        );

        if (!mounted || requestVersion != _refreshVersion) return;

        submitted = submittedRes.data['submitted'] == true;
        if (kDebugMode) {
          debugPrint("FEEDBACK: Submission status: $submitted");
        }
      }

      if (mounted && requestVersion == _refreshVersion) {
        setState(() {
          _submitted = submitted;
          _windowOpen = windowOpen;
          _windowTimeLeft = formattedTime;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted && requestVersion == _refreshVersion) {
        setState(() {
          _submitted = false;
          _windowOpen = false;
          _windowTimeLeft = '';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Don't show the card if feedback window is closed
    if (!_windowOpen) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('How did the mess do this month?',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text("You can help the mess team serve better meals.",
              style: TextStyle(color: Colors.black54)),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.access_time, color: Colors.red, size: 18),
              const SizedBox(width: 4),
              Text(
                _windowTimeLeft.isNotEmpty
                    ? 'Form closes in $_windowTimeLeft'
                    : 'Form closes soon',
                style: const TextStyle(
                    color: Colors.red, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _loading
              ? const Center(child: CircularProgressIndicator())
              : SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          _submitted ? Colors.grey : const Color(0xFF3754DB),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24)),
                    ),
                    onPressed: _submitted
                        ? null
                        : () async {
                            final prefs = await SharedPreferences.getInstance();
                            final hasMicrosoftLinked =
                                prefs.getBool('hasMicrosoftLinked') ?? false;

                            if (!hasMicrosoftLinked) {
                              if (!context.mounted) return;
                              showDialog(
                                context: context,
                                builder: (context) =>
                                    const MicrosoftRequiredDialog(
                                  featureName: 'Mess Feedback',
                                ),
                              );
                              return;
                            }

                            if (!context.mounted) return;
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const MessFeedbackPage(),
                              ),
                            );
                          },
                    child: Text(
                      _submitted ? 'Already Submitted' : 'Give feedback',
                      style: (_submitted
                          ? const TextStyle(color: Colors.black54)
                          : const TextStyle(color: Colors.white)),
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
