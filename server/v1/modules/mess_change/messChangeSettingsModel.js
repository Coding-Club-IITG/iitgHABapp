import mongoose from "mongoose";

const messChangeSettingsSchema = new mongoose.Schema(
  {
    isEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    enabledAt: {
      type: Date,
      default: null,
    },
    disabledAt: {
      type: Date,
      default: null,
    },

    lastProcessedAt: {
      type: Date,
      default: null,
    },
    currentWindowClosingTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one record exists
messChangeSettingsSchema.pre("save", async function () {
  if (!this.isNew) return;
  const count = await this.constructor.countDocuments();
  if (count > 0) {
    throw new Error("Only one mess change settings record can exist");
  }
});

export const MessChangeSettings = mongoose.model(
  "MessChangeSettings",
  messChangeSettingsSchema,
);
