import mongoose from "mongoose";

const qrSchema = new mongoose.Schema({
  qr_string: {
    type: String,
    required: true,
  },
  qr_base64: {
    type: String,
    required: true,
  },
});

export const QR = mongoose.model("QR", qrSchema);
