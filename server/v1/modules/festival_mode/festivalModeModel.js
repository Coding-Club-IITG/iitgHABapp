const mongoose = require("mongoose");

const festivalModeSchema = new mongoose.Schema({
  isEnabled: {
    type: Boolean,
    default: false,
  },
  imageWithAlerts: {
    url: {
      type: String,
      required: false,
    },
    itemId: {
      type: String,
      required: false,
    },
    overlayText: {
      type: String,
      required: false,
      default: "Happy Diwali",
    },
  },
  imageWithoutAlerts: {
    url: {
      type: String,
      required: false,
    },
    itemId: {
      type: String,
      required: false,
    },
    overlayText: {
      type: String,
      required: false,
      default: "Happy Diwali",
    },
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: false, // Optional: auto-disable after festival
  },
  cacheUntil: {
    type: Date,
    default: () => new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("FestivalMode", festivalModeSchema);
