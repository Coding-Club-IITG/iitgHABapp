const mongoose = require("mongoose");

const GALA_CATEGORIES = ["Starters", "Main Course", "Desserts"];

const galaDinnerMenuSchema = new mongoose.Schema({
  galaDinnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GalaDinner",
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    required: true,
  },
  category: {
    type: String,
    enum: GALA_CATEGORIES,
    required: true,
  },
  qrCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QR",
    required: false,
  },
});

galaDinnerMenuSchema.index({ galaDinnerId: 1, hostelId: 1, category: 1 }, { unique: true });

const GalaDinnerMenu = mongoose.model("GalaDinnerMenu", galaDinnerMenuSchema);

module.exports = { GalaDinnerMenu, GALA_CATEGORIES };
