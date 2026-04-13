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
import '../common/shimmer_host.dart';

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

  @override
  void initState() {
    super.initState();
    _checkFeedbackStatus();
    _fetchWindowTimeLeft();

    // Listen to feedback refresh notifier
    feedbackRefreshNotifier.addListener(_onRefreshNotified);
  }

  void _onRefreshNotified() {
    if (kDebugMode) debugPrint("🔄 FeedbackCard refresh triggered");
    _checkFeedbackStatus();
    _fetchWindowTimeLeft();
  }

  @override
  void dispose() {
    feedbackRefreshNotifier.removeListener(_onRefreshNotified);
    super.dispose();
  }

  Future<void> _checkFeedbackStatus() async {
    if (mounted && _windowOpen) {
      setState(() => _loading = true);
    }
    try {
      final dio = DioClient().dio;

      // Check if feedback window is open
      final settingsRes = await dio.get(MessFeedback.feedbackSettings);
      final windowOpen = settingsRes.data['isEnabled'] == true;

      if (windowOpen) {
        // Get auth token
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('access_token');
        if (kDebugMode) debugPrint("FEEDBACK: Open");
        if (token != null) {
          // Check if user has already submitted feedback
          if (kDebugMode) debugPrint("FEEDBACK: Checking submission status");
          final submittedRes = await dio.get(
            MessFeedback.feedbackSubmitted,
            options: Options(
              headers: {"Authorization": "Bearer $token"},
            ),
          );
          if (kDebugMode) {
            debugPrint(
                "FEEDBACK: Submission status: ${submittedRes.data['submitted']}");
          }
          setState(() {
            _submitted = submittedRes.data['submitted'] == true;
            _windowOpen = true;
            _loading = false;
          });
          if (kDebugMode) debugPrint("FEEDBACK: Submission status checked");
        } else {
          setState(() {
            _submitted = false;
            _windowOpen = true;
            _loading = false;
          });
          if (kDebugMode) debugPrint("FEEDBACK: No token found");
        }
      } else {
        setState(() {
          _submitted = false;
          _windowOpen = false;
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _submitted = false;
        _windowOpen = false;
        _loading = false;
      });
    }
  }

  Future<void> _fetchWindowTimeLeft() async {
    try {
      final dio = DioClient().dio;
      final res = await dio.get(MessFeedback.windowTimeLeft);
      if (res.data != null && res.data['formatted'] != null) {
        setState(() {
          _windowTimeLeft = res.data['formatted'];
        });
      } else {
        setState(() {
          _windowTimeLeft = '';
        });
      }
    } catch (e) {
      setState(() {
        _windowTimeLeft = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_windowOpen) {
      return const SizedBox.shrink();
    }

    final shell = BoxDecoration(
      border: Border.all(color: Colors.grey.shade300),
      borderRadius: BorderRadius.circular(24),
    );

    if (_loading) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: shell,
        child: ShimmerHost(
          builder: (context, box) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              box(height: 20, width: 280),
              const SizedBox(height: 12),
              box(height: 14, width: double.infinity),
              const SizedBox(height: 8),
              box(height: 14, width: 240),
              const SizedBox(height: 16),
              Row(
                children: [
                  box(
                    height: 18,
                    width: 18,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: box(
                      height: 16,
                      width: double.infinity,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              box(
                height: 48,
                width: double.infinity,
                borderRadius: BorderRadius.circular(24),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: shell,
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
          SizedBox(
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
                          builder: (context) => const MicrosoftRequiredDialog(
                            featureName: 'Mess Feedback',
                          ),
                        );
                        return;
                      }

                      setState(() {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const MessFeedbackPage(),
                          ),
                        );
                      });
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
