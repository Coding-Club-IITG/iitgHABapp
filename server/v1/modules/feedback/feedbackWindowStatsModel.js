const mongoose = require("mongoose");

const feedbackWindowStatsSchema = new mongoose.Schema(
  {
    windowNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    rows: {
      type: [
        {
          catererId: { type: String, required: true },
          catererName: { type: String, default: "" },
          totalUsers: { type: Number, default: 0 },
          smcUsers: { type: Number, default: 0 },
          avgBreakfast: { type: Number, default: 0 },
          avgLunch: { type: Number, default: 0 },
          avgDinner: { type: Number, default: 0 },
          avgHygiene: { type: Number, default: null },
          avgWasteDisposal: { type: Number, default: null },
          avgQualityOfIngredients: { type: Number, default: null },
          avgUniformAndPunctuality: { type: Number, default: null },
          overall: { type: Number, default: 0 },
          rank: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const FeedbackWindowStats = mongoose.model(
  "FeedbackWindowStats",
  feedbackWindowStatsSchema,
);

module.exports = { FeedbackWindowStats };
