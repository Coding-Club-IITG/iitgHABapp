import mongoose from "mongoose";

const feedbackSettingsSchema = new mongoose.Schema({
  isEnabled: { type: Boolean, default: false },
  enabledAt: { type: Date, default: null },
  disabledAt: { type: Date, default: null },
  currentWindowNumber: { type: Number, default: 1 },
  isAutoScheduled: { type: Boolean, default: true },
  currentWindowClosingTime: {
    type: Date,
    default: () => Date.now() + 2 * 24 * 60 * 60 * 1000,
  },
});

export const FeedbackSettings = mongoose.model(
  "FeedbackSettings",
  feedbackSettingsSchema,
);
