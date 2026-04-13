import mongoose from "mongoose";

// Define Leave Application Model
const leaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  leaveType: {
    type: String,
    enum: ["Academic", "Medical", "Casual"],
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
  numberOfDays: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Acknowledged", "Processed", "Cancelled"],
    default: "Pending",
    required: true,
  },
  acknowledgedAt: {
    type: Date,
    required: false,
  },
  processedAt: {
    type: Date,
    required: false,
  },
  proofDocumentUrl: {
    type: String,
    required: false,
  },
  leaveDocumentUrl: {
    type: String,
    required: true,
  },
  appliedAt: {
    type: Date,
    required: true,
  },
  messHostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    required: true,
  },
  bankAccountNumber: {
    type: Number,
    required: true,
  },
  bankIFSCCode: {
    type: String,
    required: true,
  },
  bankName: {
    type: String,
    required: true,
  },
  bankAccountHoldersName: {
    type: String,
    required: true,
  },
});

const Leave = mongoose.model("Leave", leaveSchema);

export default Leave;
