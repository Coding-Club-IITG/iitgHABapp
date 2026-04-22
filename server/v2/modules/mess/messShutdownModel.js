import mongoose from "mongoose";

const MESS_SHUTDOWN_TYPES = ["SINGLE_DAY", "RANGE"];

const messShutdownSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: MESS_SHUTDOWN_TYPES,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

messShutdownSchema.index({ hostelId: 1, startDate: 1 });
messShutdownSchema.index({ hostelId: 1, endDate: 1 });

export const MessShutdown = mongoose.model("MessShutdown", messShutdownSchema);
export { MESS_SHUTDOWN_TYPES };

