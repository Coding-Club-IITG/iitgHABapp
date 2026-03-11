const mongoose = require("mongoose");

const galaDinnerScanLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  galaDinnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GalaDinner",
    required: true,
  },
  startersScanned: { type: Boolean, default: false },
  startersTime: { type: String, default: null },
  mainCourseScanned: { type: Boolean, default: false },
  mainCourseTime: { type: String, default: null },
  dessertsScanned: { type: Boolean, default: false },
  dessertsTime: { type: String, default: null },
});

galaDinnerScanLogSchema.index({ userId: 1, galaDinnerId: 1 }, { unique: true });

const GalaDinnerScanLog = mongoose.model("GalaDinnerScanLog", galaDinnerScanLogSchema);

module.exports = { GalaDinnerScanLog };
