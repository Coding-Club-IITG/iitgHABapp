const mongoose = require("mongoose");


const messClosureSchema = new mongoose.Schema({
    hostelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hostel",
        required: true,
    },
    closureDate: {
        type: Date,
        required: true,
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: { type: Number, required: true },
    finalizedAt: {
        type: Date,
        default: Date.now,
    },
    scheduledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    notificationSent: {
        type: Boolean,
        default: false,
    },
    reminderScheduled: {
        type: Boolean,
        default: false,
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


// Indexes
messClosureSchema.index({ hostelId: 1, month: 1, year: 1 }, { unique: true }); // Enforce one closure per hostel per month
messClosureSchema.index({ closureDate: 1 }); // For date-based queries
messClosureSchema.index({ notificationSent: 1, reminderScheduled: 1 }); // For scheduler logic

const MessClosure = mongoose.model("MessClosure", messClosureSchema);
module.exports = { MessClosure };