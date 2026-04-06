const mongoose = require("mongoose");

const UserAllocHostelSchema = new mongoose.Schema({
  rollno: {
    type: String,
    required: true,
    unique: true,
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
  },
  current_subscribed_mess: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
  },
});

const UserAllocHostel = mongoose.model(
  "UserAllocHostel",
  UserAllocHostelSchema
);

module.exports = UserAllocHostel;
