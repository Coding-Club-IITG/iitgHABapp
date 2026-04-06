const mongoose = require("mongoose");

const scanLogsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  messId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mess",
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  breakfast: {
    type: Boolean,
    default: false,
  },
  breakfastTime: {
    type: String,
    default: null,
  },
  lunch: {
    type: Boolean,
    default: false,
  },
  lunchTime: {
    type: String,
    default: null,
  },
  dinner: {
    type: Boolean,
    default: false,
  },
  dinnerTime: {
    type: String,
    default: null,
  },
});

scanLogsSchema.index({ userId: 1, messId: 1, date: 1 });
scanLogsSchema.index({ date: 1, messId: 1 });

const ScanLogs = mongoose.model("ScanLogs", scanLogsSchema);
module.exports = { ScanLogs };
