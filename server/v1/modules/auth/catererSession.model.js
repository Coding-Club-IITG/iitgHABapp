import mongoose from "mongoose";
import crypto from "crypto";

/**
 * HABit HQ caterer (Google) refresh sessions — separate from student User Session.
 * refreshToken is stored SHA-256 hashed (raw token only sent to client once per rotation).
 */
const catererSessionSchema = new mongoose.Schema({
  mess: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mess",
    required: true,
    index: true,
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    required: true,
    index: true,
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true,
  },
  userAgent: { type: String },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
});

catererSessionSchema.pre("save", function () {
  if (!this.isModified("refreshToken")) return;
  this.refreshToken = crypto
    .createHash("sha256")
    .update(this.refreshToken)
    .digest("hex");
});

const CatererSession = mongoose.model("CatererSession", catererSessionSchema);

export default CatererSession;
