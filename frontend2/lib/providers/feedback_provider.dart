import 'package:flutter/material.dart';

class FeedbackProvider extends ChangeNotifier {
  String breakfast = '';
  String lunch = '';
  String dinner = '';
  String comment = '';

  // Extra SMC fields
  String hygiene = '';
  String wasteDisposal = '';
  String qualityOfIngredients = '';
  String uniformAndPunctuality = '';

  // Load SMC status
  bool isSMC = false;
  // avoid provider rebuilds when persisted SMC status is unchanged.
  void setIsSMC(bool status) {
    if (isSMC == status) return;
    isSMC = status;
    notifyListeners();
  }

  void loadSMCStatus(bool status) => setIsSMC(status);

  // Set meal feedback
  void setMealFeedback(String meal, String val) {
    // only notify listeners when a field actually changes.
    bool changed = false;
    switch (meal) {
      case 'breakfast':
        if (breakfast == val) return;
        breakfast = val;
        changed = true;
        break;
      case 'lunch':
        if (lunch == val) return;
        lunch = val;
        changed = true;
        break;
      case 'dinner':
        if (dinner == val) return;
        dinner = val;
        changed = true;
        break;
    }
    if (changed) notifyListeners();
  }

  // Set extra SMC feedback
  void setSMCFeedback(String field, String val) {
    // suppress redundant notifications for same-option taps.
    bool changed = false;
    switch (field) {
      case 'hygiene':
        if (hygiene == val) return;
        hygiene = val;
        changed = true;
        break;
      case 'wasteDisposal':
        if (wasteDisposal == val) return;
        wasteDisposal = val;
        changed = true;
        break;
      case 'qualityOfIngredients':
        if (qualityOfIngredients == val) return;
        qualityOfIngredients = val;
        changed = true;
        break;
      case 'uniformAndPunctuality':
        if (uniformAndPunctuality == val) return;
        uniformAndPunctuality = val;
        changed = true;
        break;
    }
    if (changed) notifyListeners();
  }

  // Set comment
  void setComment(String value) {
    // prevents unnecessary widget rebuilds while typing same value.
    if (comment == value) return;
    comment = value;
    notifyListeners();
  }

  // Clear all fields
  void clear() {
    // notify only when there was state to clear.
    final hadValues = breakfast.isNotEmpty ||
        lunch.isNotEmpty ||
        dinner.isNotEmpty ||
        comment.isNotEmpty ||
        hygiene.isNotEmpty ||
        wasteDisposal.isNotEmpty ||
        qualityOfIngredients.isNotEmpty ||
        uniformAndPunctuality.isNotEmpty;

    breakfast = '';
    lunch = '';
    dinner = '';
    comment = '';

    hygiene = '';
    wasteDisposal = '';
    qualityOfIngredients = '';
    uniformAndPunctuality = '';

    if (hadValues) notifyListeners();
  }

  // Check if feedback is complete
  bool isComplete() {
    bool basicComplete =
        breakfast.isNotEmpty && lunch.isNotEmpty && dinner.isNotEmpty;

    if (isSMC) {
      bool smcComplete = hygiene.isNotEmpty &&
          wasteDisposal.isNotEmpty &&
          qualityOfIngredients.isNotEmpty &&
          uniformAndPunctuality.isNotEmpty;
      return basicComplete && smcComplete;
    }

    return basicComplete;
  }
}
