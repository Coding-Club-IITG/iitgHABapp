import mongoose from "mongoose";

const messChangeSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  rollNumber: {
    type: String,
    required: true,
    unique: true,
  },
  fromHostel: {
    type: String,
    required: true,
  },
  // Final allocated hostel
  toHostel: {
    type: String,
    required: true,
  },
  // Preference fields: 1 is compulsory, 2 and 3 are optional
  toHostel1: {
    type: String,
    required: true,
  },
  toHostel2: {
    type: String,
  },
  toHostel3: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
messChangeSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const MessChange = mongoose.model("MessChange", messChangeSchema);
