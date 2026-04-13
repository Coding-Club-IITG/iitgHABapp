import mongoose from "mongoose";

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

// subscriber aggregation matches by these fields during OPI computation.
UserAllocHostelSchema.index({ current_subscribed_mess: 1 });
UserAllocHostelSchema.index({ hostel: 1 });

const UserAllocHostel = mongoose.model(
  "UserAllocHostel",
  UserAllocHostelSchema,
);

export default UserAllocHostel;
