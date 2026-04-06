const mongoose = require("mongoose");

// Feedback for a single room-cleaning booking.
// Each RcFeedback document is linked from RoomCleaningBooking.feedbackId.

const rcFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomCleaningBooking",
      required: true,
      unique: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    // Q1: Did staff visit during the selected slot?
    reachedInSlot: {
      type: String,
      enum: ["Yes", "No", "NotSure"],
      required: true,
    },
    // Q2: Was the staff polite/professional?
    staffPoliteness: {
      type: String,
      enum: ["Yes", "No", "NotSure"],
      required: true,
    },
    // Q3: Overall satisfaction (1–5).
    satisfaction: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    // Optional free-text remarks.
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

const RcFeedback = mongoose.model("RcFeedback", rcFeedbackSchema);

module.exports = { RcFeedback };

