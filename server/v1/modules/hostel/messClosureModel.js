import mongoose from "mongoose";

const messClosureSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    required: true,
  },
  closureDate: {
    type: Date,
    required: true,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: { type: Number, required: true },
  finalizedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure one hostel can only pick one date per month
messClosureSchema.index({ hostelId: 1, month: 1, year: 1 }, { unique: true });

export const MessClosure = mongoose.model("MessClosure", messClosureSchema);
