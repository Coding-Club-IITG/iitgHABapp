import mongoose from "mongoose";

const profileSettingsSchema = new mongoose.Schema(
  {
    allowProfilePhotoChange: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Enforce singleton document
profileSettingsSchema.pre("save", async function (next) {
  const Model = mongoose.model("ProfileSettings");
  if (this.isNew) {
    const count = await Model.countDocuments();
    if (count > 0) {
      return next(new Error("Only one ProfileSettings document can exist"));
    }
  }
  return next();
});

export const ProfileSettings = mongoose.model(
  "ProfileSettings",
  profileSettingsSchema,
);
