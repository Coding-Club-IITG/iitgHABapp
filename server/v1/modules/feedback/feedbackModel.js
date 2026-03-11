const mongoose = require("mongoose");

const ratingOptions = ["Very Poor", "Poor", "Average", "Good", "Very Good"];

const feedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  breakfast: {
    type: String,
    enum: ratingOptions,
    required: true,
  },
  lunch: {
    type: String,
    enum: ratingOptions,
    required: true,
  },
  dinner: {
    type: String,
    enum: ratingOptions,
    required: true,
  },
  comment: {
    type: String,
    default: "",
  },

  // Save caterer/mess reference at time of submission
  caterer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mess",
    index: true,
  },

  // Extra fields if user is SMC
  smcFields: {
    type: {
      hygiene: { type: String, enum: ratingOptions },
      wasteDisposal: { type: String, enum: ratingOptions },
      qualityOfIngredients: { type: String, enum: ratingOptions },
      uniformAndPunctuality: { type: String, enum: ratingOptions },
    },
    default: null,
  },

  // Feedback window number
  feedbackWindowNumber: {
    type: Number,
    required: true,
  },
});

feedbackSchema.index({ user: 1, feedbackWindowNumber: 1 });
feedbackSchema.index({ feedbackWindowNumber: 1, caterer: 1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
