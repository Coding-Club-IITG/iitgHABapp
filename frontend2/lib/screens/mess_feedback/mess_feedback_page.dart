import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/feedback_provider.dart';
import '../../widgets/common/page_loading_shimmer.dart';
import '../../widgets/feedback/custom_option.dart';
import 'comment_page.dart';

class MessFeedbackPage extends StatefulWidget {
  const MessFeedbackPage({super.key});

  @override
  State<MessFeedbackPage> createState() => _MessFeedbackPageState();
}

class _MessFeedbackPageState extends State<MessFeedbackPage> {
  bool _loading = true;

  final List<String> options = [
    'Very Poor',
    'Poor',
    'Average',
    'Good',
    'Very Good'
  ];

  Widget mealBlock(String meal, String selected, Function(String) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
            margin: const EdgeInsets.only(left: 24),
            child: Text(meal,
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 20))),
        const SizedBox(height: 8),
        ...options.map((option) => customOption(
              text: option,
              groupValue: selected,
              value: option,
              onChanged: onChanged,
            )),
      ],
    );
  }

  Widget smcBlock(String label, String selected, Function(String) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        ...options.map((option) => customOption(
              text: option,
              groupValue: selected,
              value: option,
              onChanged: onChanged,
            )),
      ],
    );
  }

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final instance = await SharedPreferences.getInstance();
    if (!mounted) return;
    final provider = Provider.of<FeedbackProvider>(context, listen: false);
    provider.loadSMCStatus(instance.getBool('isSMC') ?? false);
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          leading: const BackButton(),
          backgroundColor: Colors.white,
          elevation: 0,
        ),
        body: SafeArea(child: buildMessFeedbackLoadingShimmer()),
      );
    }

    final provider = Provider.of<FeedbackProvider>(context);

    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: Container(
        color: Colors.white,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, top: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Mess Feedback",
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2E2F31),
                  ),
                ),
                const SizedBox(height: 32),
                const Text("Step 1 / 2",
                    style: TextStyle(color: Colors.deepPurple)),
                const SizedBox(height: 11),
                const LinearProgressIndicator(
                    value: 0.5, color: Colors.deepPurple),
                const SizedBox(height: 16),
                Expanded(
                  child: ListView(
                    children: [
                      const Text(
                        "How satisfied are you with the respective meals?",
                        style: TextStyle(
                            fontWeight: FontWeight.w500,
                            fontSize: 20),
                      ),
                      const SizedBox(height: 24),
                      mealBlock("Breakfast", provider.breakfast,
                          (val) => provider.setMealFeedback('breakfast', val)),
                      const SizedBox(height: 24),
                      mealBlock("Lunch", provider.lunch,
                          (val) => provider.setMealFeedback('lunch', val)),
                      const SizedBox(height: 24),
                      mealBlock("Dinner", provider.dinner,
                          (val) => provider.setMealFeedback('dinner', val)),

                      // SMC extra fields
                      if (provider.isSMC) ...[
                        const SizedBox(height: 24),
                        const Text(
                          "Additional SMC Feedback",
                          style: TextStyle(
                              fontWeight: FontWeight.w500,
                              fontSize: 20),
                        ),
                        const SizedBox(height: 16),
                        smcBlock("Hygiene", provider.hygiene,
                            (val) => provider.setSMCFeedback('hygiene', val)),
                        smcBlock(
                            "Waste Disposal",
                            provider.wasteDisposal,
                            (val) =>
                                provider.setSMCFeedback('wasteDisposal', val)),
                        smcBlock(
                            "Quality of Ingredients",
                            provider.qualityOfIngredients,
                            (val) => provider.setSMCFeedback(
                                'qualityOfIngredients', val)),
                        smcBlock(
                            "Uniform & Punctuality",
                            provider.uniformAndPunctuality,
                            (val) => provider.setSMCFeedback(
                                'uniformAndPunctuality', val)),
                      ],
                    ],
                  ),
                ),
                Center(
                  child: SizedBox(
                    width: 358,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: provider.isComplete()
                          ? () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const CommentPage(),
                                ),
                              )
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color.fromRGBO(76, 78, 219, 1),
                        disabledBackgroundColor: const Color(0xFFD9D9D9),
                        foregroundColor: Colors.white,
                        disabledForegroundColor: const Color(0xFF7A7A7A),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(9999),
                        ),
                      ),
                      child: const Text(
                        'Next',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
