import mongoose from "mongoose";

const summerMessSettingsSchema = new mongoose.Schema(
  {
    seasonKey: {
      type: String,
      trim: true,
      required: true,
    },
    seasonLabel: {
      type: String,
      trim: true,
      required: true,
    },
    isRegistrationOpen: {
      type: Boolean,
      default: false,
      required: true,
    },
    registrationStartAt: {
      type: Date,
      default: null,
    },
    registrationEndAt: {
      type: Date,
      default: null,
    },
    isSummerActive: {
      type: Boolean,
      default: false,
      required: true,
    },
    summerStartAt: {
      type: Date,
      default: null,
    },
    summerEndAt: {
      type: Date,
      default: null,
    },
    ratePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    participatingHostels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hostel",
      },
    ],
    activatedAt: {
      type: Date,
      default: null,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

summerMessSettingsSchema.index({ seasonKey: 1 });
summerMessSettingsSchema.index({ isRegistrationOpen: 1, registrationStartAt: 1 });
summerMessSettingsSchema.index({ isSummerActive: 1, summerStartAt: 1 });

export const SummerMessSettings = mongoose.model(
  "SummerMessSettings",
  summerMessSettingsSchema,
);
