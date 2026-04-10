// alert/alertModel.js

const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    hasCountdown: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    targetType: { 
      type: String, 
      enum: ["mess", "hostel", "global"], 
      required: true 
    },
    // References to Hostel IDs (used for both hostels and messes in your system)
    targetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hostel" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// Automatically delete documents from MongoDB when expiresAt is reached
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Optimize read queries
alertSchema.index({ targetType: 1, targetIds: 1 });

module.exports = mongoose.model("Alert", alertSchema);
