import mongoose from "mongoose";

const messSubscribersSnapshotSchema = new mongoose.Schema(
  {
    hostelId: {
      // This is the mess hostel (i.e., current_subscribed_mess)
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    subscribers: [
      {
        rollNumber: { type: String, required: true },
        boardingHostelId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Hostel",
          default: null,
        },
        boardingHostelName: { type: String, default: "" },
        subscribedMessHostelName: { type: String, default: "" },
      },
    ],
    totalCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

messSubscribersSnapshotSchema.index(
  { hostelId: 1, month: 1, year: 1 },
  { unique: true },
);

export const MessSubscribersSnapshot = mongoose.model(
  "MessSubscribersSnapshot",
  messSubscribersSnapshotSchema,
);

