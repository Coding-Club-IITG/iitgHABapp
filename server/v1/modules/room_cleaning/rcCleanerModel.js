const mongoose = require("mongoose");

// Room cleaner configuration per hostel.
// Each cleaner can work in one or more fixed slots (A–D).

const rcCleanerSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slots: {
      type: [String],
      enum: ["A", "B", "C", "D"],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Cleaner must be assigned to at least one slot",
      },
    },
    // Seed neutral baseline so averageRating is meaningful before first feedback.
    totalFeedbacks: {
      type: Number,
      default: 1,
      min: 1,
    },
    averageRating: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
  },
  { timestamps: true },
);

const RcCleaner = mongoose.model("RcCleaner", rcCleanerSchema);

module.exports = { RcCleaner };

