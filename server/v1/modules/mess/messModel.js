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
});

export const Mess = mongoose.model("Mess", messSchema);
