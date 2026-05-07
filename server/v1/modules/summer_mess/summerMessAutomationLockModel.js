import mongoose from "mongoose";

const summerMessAutomationLockSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    owner: {
      type: String,
      default: null,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

summerMessAutomationLockSchema.index({ key: 1 }, { unique: true });

export const SummerMessAutomationLock = mongoose.model(
  "SummerMessAutomationLock",
  summerMessAutomationLockSchema,
);
