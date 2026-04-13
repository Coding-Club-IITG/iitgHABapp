import mongoose from "mongoose";

// persist closed-window leaderboard rows to avoid expensive recomputation on historical reads.
const feedbackWindowStatsSchema = new mongoose.Schema(
  {
    windowNumber: {
      type: Number,
      required: true,
      index: true,
    },
    caterer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mess",
      required: true,
      index: true,
    },
    catererName: {
      type: String,
      required: true,
      default: "",
    },
    totalUsers: { type: Number, required: true, default: 0 },
    smcUsers: { type: Number, required: true, default: 0 },
    avgBreakfast: { type: Number, required: true, default: 0 },
    avgLunch: { type: Number, required: true, default: 0 },
    avgDinner: { type: Number, required: true, default: 0 },
    avgHygiene: { type: Number, default: null },
    avgWasteDisposal: { type: Number, default: null },
    avgQualityOfIngredients: { type: Number, default: null },
    avgUniformAndPunctuality: { type: Number, default: null },
    overall: { type: Number, required: true, default: 0 },
    rank: { type: Number, required: true, default: 0 },
    snapshotAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
  },
);

feedbackWindowStatsSchema.index(
  { windowNumber: 1, caterer: 1 },
  { unique: true },
);
// speeds ordered leaderboard reads within a window.
feedbackWindowStatsSchema.index({ windowNumber: 1, rank: 1 });

const FeedbackWindowStats = mongoose.model(
  "FeedbackWindowStats",
  feedbackWindowStatsSchema,
);

export default FeedbackWindowStats;
