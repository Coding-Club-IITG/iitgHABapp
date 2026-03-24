const mongoose = require("mongoose");
const crypto = require("crypto");

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  refreshToken: {
    type: String, // ideally hashed
    required: true,
  },

  userAgent: {
    type: String, // device info
  },

  ipAddress: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  expiresAt: {
    type: Date,
    required: true,
  },

  isRevoked: {
    type: Boolean,
    default: false,
  },
});

sessionSchema.pre("save", function (next) {
  if (!this.isModified("refreshToken")) return next();

  this.refreshToken = crypto
    .createHash("sha256")
    .update(this.refreshToken)
    .digest("hex");

  next();
});

module.exports = mongoose.model("Session", sessionSchema);
