const mongoose = require("mongoose");

const messWorkerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      enum: ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"],
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mess",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const MessWorker = mongoose.model("MessWorker", messWorkerSchema);

module.exports = { MessWorker };
