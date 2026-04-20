import mongoose from "mongoose";

const messSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
  },
  complaints: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
    },
  ],
  rating: {
    type: Number,
    default: 0,
  },
  ranking: {
    type: Number,
    default: 0,
  },
  /** Subscriber feedback % (0–100 scale, same as spreadsheet). */
  feedbackPercentage: {
    type: Number,
    default: 0,
  },
  qrCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QR",
  },
  /**
   * HABit HQ (caterer Google sign-in): verified Google Workspace / Gmail allowed for this mess.
   * Lowercase; unique when set.
   */
  managerGoogleEmail: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    unique: true,
    index: true,
  },
});

export const Mess = mongoose.model("Mess", messSchema);
