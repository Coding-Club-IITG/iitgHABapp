import mongoose from "mongoose";

const SUMMER_MESS_APPLICATION_STATUSES = [
  "Pending",
  "Acknowledged",
  "Cancelled",
];

const summerMessApplicationSchema = new mongoose.Schema(
  {
    seasonKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    boardingHostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    appliedHostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    ratePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentProofUrl: {
      type: String,
      default: "",
      trim: true,
    },
    paymentProofFilename: {
      type: String,
      default: "",
      trim: true,
    },
    registrationTermsAccepted: {
      type: Boolean,
      default: false,
    },
    paymentProofDeclarationAccepted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: SUMMER_MESS_APPLICATION_STATUSES,
      default: "Pending",
      required: true,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedByHostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Partial unique index: only enforce uniqueness for non-cancelled applications
// This allows multiple applications per season per user, but only one active one at a time
summerMessApplicationSchema.index(
  { seasonKey: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["Pending", "Acknowledged"] },
    },
  },
);

// Additional index for faster queries
summerMessApplicationSchema.index({ seasonKey: 1, user: 1, status: 1 });

export const SummerMessApplication = mongoose.model(
  "SummerMessApplication",
  summerMessApplicationSchema,
);

export { SUMMER_MESS_APPLICATION_STATUSES };
