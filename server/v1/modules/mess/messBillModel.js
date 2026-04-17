import mongoose from "mongoose";

const messBillSchema = new mongoose.Schema(
  {
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    hostelName: {
      type: String,
      required: true,
    },
    month: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    accountNumber: {
      type: String,
      default: "",
    },
    operatingDays: {
      type: Number,
      default: 30,
    },
    shutdownDate: {
      type: String,
      default: "NA",
    },
    totalSubscribers: {
      type: Number,
      default: 0,
    },
    totalSubscribersOffset: {
      type: Number,
      default: 0,
    },
    messDays: {
      type: Number,
      default: 0,
    },
    rebateDays: {
      type: Number,
      default: 0,
    },
    rebateDaysOffset: {
      type: Number,
      default: 0,
    },
    consumingDays: {
      type: Number,
      default: 0,
    },
    foodCost: {
      type: Number,
      default: 0,
    },
    totalWage: {
      type: Number,
      default: 0,
    },
    messBillClaimed: {
      type: Number,
      default: 0,
    },
    messBill: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    tdsAmount: {
      type: Number,
      default: 0,
    },
    firstInstallment: {
      type: Number,
      default: 0,
    },
    secondInstallment: {
      type: Number,
      default: 0,
    },
    rebateReimbursement: {
      type: Number,
      default: 0,
    },
    miscDeduction: {
      type: Number,
      default: 0,
    },
    habTransfer: {
      type: Number,
      default: 0,
    },
    totalExpenditure: {
      type: Number,
      default: 0,
    },
    workerAttendances: {
      type: Map,
      of: Number,
      default: {},
    },
    billLink: {
      type: String,
      default: "",
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Ensure only one bill per hostel per month-year combination
messBillSchema.index({ hostel: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("MessBill", messBillSchema);
