import mongoose from "mongoose";

const fcmTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    token: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("FCMToken", fcmTokenSchema);
