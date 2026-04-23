import mongoose from "mongoose";

export const REPORT_FILE_TYPES = [
  "MessChangeReport",
  "FeedbackReport",
];

const reportSchema = new mongoose.Schema(
  {
    fileType: {
      type: String,
      enum: REPORT_FILE_TYPES,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    year: { type: Number, required: true, index: true },
    link: { type: String, required: true },
  },
  { timestamps: true },
);

reportSchema.index({ fileType: 1, month: 1, year: 1 });

export const Report = mongoose.model("Report", reportSchema);

