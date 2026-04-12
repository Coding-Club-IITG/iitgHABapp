import mongoose from "mongoose";

const galaDinnerSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    startersServingStartTime: { type: String, trim: true },
    dinnerServingStartTime: { type: String, trim: true },
  },
  { timestamps: true },
);

export const GalaDinner = mongoose.model("GalaDinner", galaDinnerSchema);
