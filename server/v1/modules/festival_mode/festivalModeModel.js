import mongoose from "mongoose";

const festivalImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: false },
    itemId: { type: String, required: false },
    overlayText: { type: String, required: false, default: "Happy Diwali" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
  // New fields (backward-compatible): support multiple images and texts.
  imagesWithAlerts: {
    type: [festivalImageSchema],
    default: [],
  },
  imagesWithoutAlerts: {
    type: [festivalImageSchema],
    default: [],
  },
  textsWithAlerts: {
    type: [String],
    default: [],
  },
  textsWithoutAlerts: {
    type: [String],
    default: [],
  },
  // Admin-selectable theme color (hex string like "#4C4EDB")
  themeColor: {
    type: String,
    default: "#4C4EDB",
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

const FestivalMode = mongoose.model("FestivalMode", festivalModeSchema);

export default FestivalMode;
