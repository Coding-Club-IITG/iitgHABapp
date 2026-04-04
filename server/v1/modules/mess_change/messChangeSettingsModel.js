const mongoose = require("mongoose");

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
  },
  {
    timestamps: true,
  }
);

// Ensure only one record exists
messChangeSettingsSchema.pre("save", async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    if (count > 0) {
      return next(new Error("Only one mess change settings record can exist"));
    }
  }
  next();
});

const MessChangeSettings = mongoose.model(
  "MessChangeSettings",
  messChangeSettingsSchema
);

module.exports = { MessChangeSettings };
