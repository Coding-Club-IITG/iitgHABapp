const mongoose = require("mongoose");

const bugReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    screenshots: [
      {
        url: {
          type: String,
          required: true,
        },
        filename: {
          type: String,
          required: true,
        },
      },
    ],
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional - can be anonymous
    },
    email: {
      type: String,
      required: false, // Optional - can be anonymous
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved", "closed"],
      default: "pending",
    },
    deviceInfo: {
      device: String,
      os: String,
      appVersion: String,
    },
    frequency: {
      type: String,
      enum: ["always", "sometimes", "once"],
    },
  },
  {
    timestamps: true,
  }
);

const BugReport = mongoose.model("BugReport", bugReportSchema);

module.exports = BugReport;

