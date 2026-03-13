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
  void loadSMCStatus(bool status) {
    if (isSMC == status) return;
    isSMC = status;
    notifyListeners();
  }

  // Set meal feedback
  void setMealFeedback(String meal, String val) {
    bool changed = false;
    switch (meal) {
      case 'breakfast':
        changed = breakfast != val;
        breakfast = val;
        break;
      case 'lunch':
        changed = lunch != val;
        lunch = val;
        break;
      case 'dinner':
        changed = dinner != val;
        dinner = val;
        break;
    }
    if (changed) notifyListeners();
  }

  // Set extra SMC feedback
  void setSMCFeedback(String field, String val) {
    bool changed = false;
    switch (field) {
      case 'hygiene':
        changed = hygiene != val;
        hygiene = val;
        break;
      case 'wasteDisposal':
        changed = wasteDisposal != val;
        wasteDisposal = val;
        break;
      case 'qualityOfIngredients':
        changed = qualityOfIngredients != val;
        qualityOfIngredients = val;
        break;
      case 'uniformAndPunctuality':
        changed = uniformAndPunctuality != val;
        uniformAndPunctuality = val;
        break;
    }
    if (changed) notifyListeners();
  }

  // Set comment
  void setComment(String value) {
    if (comment == value) return;
    comment = value;
    notifyListeners();
  }

  // Clear all fields
  void clear() {
    breakfast = '';
    lunch = '';
    dinner = '';
    comment = '';

    if (isSMC) {
      hygiene = '';
      wasteDisposal = '';
      qualityOfIngredients = '';
      uniformAndPunctuality = '';
    }

    notifyListeners();
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
