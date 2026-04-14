import mongoose from "mongoose";

const messSettingsSchema = new mongoose.Schema(
  {
    messRebateEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Enforce singleton document
messSettingsSchema.pre("save", async function () {
  const Model = mongoose.model("MessSettings");
  if (this.isNew) {
    const count = await Model.countDocuments();
    if (count > 0) {
      throw new Error("Only one MessSettings document can exist");
    }
  }
});

export const MessSettings = mongoose.model("MessSettings", messSettingsSchema);

