const mongoose = require("mongoose");

const galaDinnerSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    startersServingStartTime: { type: String, trim: true },
    dinnerServingStartTime: { type: String, trim: true },
  },
  { timestamps: true }
);

const GalaDinner = mongoose.model("GalaDinner", galaDinnerSchema);

module.exports = { GalaDinner };
