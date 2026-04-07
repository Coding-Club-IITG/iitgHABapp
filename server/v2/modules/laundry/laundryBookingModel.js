const mongoose = require("mongoose");

/**
 * One laundry service use per user (1 free every 2 weeks).
 * Each scan creates a LaundryBooking and updates user.lastLaundryUsed.
 */
const laundryBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

laundryBookingSchema.index({ userId: 1, usedAt: -1 });

const LaundryBooking = mongoose.model("LaundryBooking", laundryBookingSchema);

module.exports = { LaundryBooking };
