import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const __dirname = import.meta.dirname;
dotenv.config({ path: path.join(__dirname, "../../.env") });

import { mongodbUri } from "../config/default.js";
import { Hostel } from "../modules/hostel/hostelModel.js";
import { Mess } from "../modules/mess/messModel.js";

async function main() {
  const type = process.argv[2]; // --mess or --rc
  const hostelQuery = process.argv[3];
  const value = process.argv[4];

  if (
    !type ||
    !hostelQuery ||
    !value ||
    (type !== "--mess" && type !== "--rc")
  ) {
    console.log("Usage:");
    console.log("  For Mess Manager Google Email (HABit HQ):");
    console.log(
      "    node scripts/set_manager_credentials.js --mess <HostelName> <GoogleEmail>",
    );
    console.log("  For Room Cleaning Manager Password (HABit RC):");
    console.log(
      "    node scripts/set_manager_credentials.js --rc <HostelName> <Password>\n",
    );
    process.exit(1);
  }

  await mongoose.connect(mongodbUri);

  const hostel = await Hostel.findOne({
    hostel_name: new RegExp(
      hostelQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    ),
  });

  if (!hostel) {
    console.error(`❌ No hostel matching "${hostelQuery}" found.`);
    process.exit(1);
  }

  if (type === "--mess") {
    const email = value.trim().toLowerCase();
    let mess = await Mess.findOne({ hostelId: hostel._id });
    if (!mess) {
      console.error(
        `❌ No mess found linked to hostel "${hostel.hostel_name}".`,
      );
      process.exit(1);
    }
    mess.managerGoogleEmail = email;
    await mess.save();
    console.log(
      `✅ [Mess Manager] Updated managerGoogleEmail for ${mess.name} to: ${email}`,
    );
  } else if (type === "--rc") {
    const password = value.trim();
    const hash = await bcrypt.hash(password, 10);
    hostel.managerPasswordHash = hash;
    await hostel.save();
    console.log(
      `✅ [RC Manager] Updated managerPasswordHash for hostel ${hostel.hostel_name}`,
    );
  }
}

main()
  .catch((e) => {
    console.error("❌ Error updating credentials:", e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
