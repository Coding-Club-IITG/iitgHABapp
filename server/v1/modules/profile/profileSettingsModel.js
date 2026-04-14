import mongoose from "mongoose";

const profileSettingsSchema = new mongoose.Schema(
  {
    allowProfilePhotoChange: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Enforce singleton document
profileSettingsSchema.pre("save", async function () {
  const Model = mongoose.model("ProfileSettings");
  if (this.isNew) {
    const count = await Model.countDocuments();
    if (count > 0) {
      throw new Error("Only one ProfileSettings document can exist");
    }
  }
});

export const ProfileSettings = mongoose.model(
  "ProfileSettings",
  profileSettingsSchema,
);
