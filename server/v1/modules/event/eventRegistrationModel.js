import mongoose from "mongoose";

export const REGISTRATION_STATUSES = ["pending", "approved", "rejected"];

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "pending",
    },
    // Random secret encoded in the student's entry QR; issued on approval.
    qrToken: { type: String, default: undefined },
    checkedInAt: { type: Date, default: null },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });
eventRegistrationSchema.index({ qrToken: 1 }, { unique: true, sparse: true });
eventRegistrationSchema.index({ event: 1, status: 1 });

export const EventRegistration = mongoose.model(
  "EventRegistration",
  eventRegistrationSchema,
);
