/**
 * One-off: set a user's hostel (and curr_subscribed_mess + UserAllocHostel) by roll number.
 *
 * Usage (from server/v1):
 *   node scripts/set_user_hostel_by_roll.js <rollNumber> <hostelNameSubstring>
 *
 * Example:
 *   node scripts/set_user_hostel_by_roll.js 230123002 Kameng
 *
 * Hostel is resolved by case-insensitive substring match on hostel_name (first match).
 */
import path from "path";
import dotenv from "dotenv";

const __dirname = import.meta.dirname;
dotenv.config({ path: path.join(__dirname, "../../.env") });

import mongoose from "mongoose";
import { mongodbUri } from "../config/default.js";
import { User } from "../modules/user/userModel.js";
import { Hostel } from "../modules/hostel/hostelModel.js";
import UserAllocHostel from "../modules/hostel/hostelAllocModel.js";
import redisClient from "../utils/redisClient.js";

async function main() {
  const roll = process.argv[2]?.trim();
  const hostelQuery = process.argv[3]?.trim();

  if (!roll || !hostelQuery) {
    console.error(
      "Usage: node scripts/set_user_hostel_by_roll.js <rollNumber> <hostelNameSubstring>",
    );
    process.exit(1);
  }

  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(mongodbUri);

  const user = await User.findOne({ rollNumber: roll });
  if (!user) {
    console.error(`No user with rollNumber=${roll}`);
    process.exit(1);
  }

  const hostel = await Hostel.findOne({
    hostel_name: new RegExp(hostelQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  });

  if (!hostel) {
    console.error(`No hostel matching "${hostelQuery}" in hostel_name`);
    process.exit(1);
  }

  const beforeHostel = user.hostel
    ? await Hostel.findById(user.hostel).select("hostel_name").lean()
    : null;

  user.hostel = hostel._id;
  user.curr_subscribed_mess = hostel._id;
  await user.save();

  await UserAllocHostel.findOneAndUpdate(
    { rollno: roll },
    {
      $set: {
        hostel: hostel._id,
        current_subscribed_mess: hostel._id,
      },
    },
    { upsert: true, new: true },
  );

  try {
    await redisClient.del("all_users");
    await redisClient.del("user_count");
    await redisClient.del(`user_by_roll_${roll}`);
    await redisClient.del(`user_for_manager_${user._id}`);
  } catch (e) {
    console.warn("[redis] cache clear skipped:", e.message);
  }

  console.log(
    `[set_user_hostel_by_roll] OK roll=${roll}: ` +
      `${beforeHostel?.hostel_name ?? "(none)"} -> ${hostel.hostel_name} (${hostel._id})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
