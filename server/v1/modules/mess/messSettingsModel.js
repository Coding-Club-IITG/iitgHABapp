import mongoose from "mongoose";

const messSettingsSchema = new mongoose.Schema(
  {
    messRebateEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Enforce singleton document
messSettingsSchema.pre("save", async function (next) {
  const Model = mongoose.model("MessSettings");
  if (this.isNew) {
    const count = await Model.countDocuments();
    if (count > 0) {
      return next(new Error("Only one MessSettings document can exist"));
    }
  }
  return next();
});

export const MessSettings = mongoose.model("MessSettings", messSettingsSchema);

