import fs from "fs";
import path from "path";
const __dirname = import.meta.dirname;
import mongoose from "mongoose";

import { User } from "../modules/user/userModel.js";
import { Hostel } from "../modules/hostel/hostelModel.js";

import { mongodbUri } from "../config/default.js";

async function exportMessChangers() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongodbUri);
    console.log("Connected successfully.");

    // Fetch hostels to map IDs to names
    const hostels = await Hostel.find({});
    const hostelMap = {};
    hostels.forEach((h) => {
      hostelMap[h._id.toString()] = h.hostel_name;
    });

    console.log("Fetching users who got their mess changed...");
    // Find users where got_mess_changed is true
    const users = await User.find({ got_mess_changed: true });

    console.log(`Found ${users.length} users with successful mess changes.`);

    if (users.length === 0) {
      console.log("No users found with got_mess_changed: true.");
      await mongoose.connection.close();
      return;
    }

    let csvContent = "\ufeff"; // BOM for Excel UTF-8
    csvContent += "roll number,name,hostel,current_subscribed_mess\n";

    users.forEach((u) => {
      const rollNumber = u.rollNumber || "N/A";
      const name = u.name || "N/A";
      const hostelName = u.hostel
        ? hostelMap[u.hostel.toString()] || "Unknown"
        : "N/A";
      const currentMessName = u.curr_subscribed_mess
        ? hostelMap[u.curr_subscribed_mess.toString()] || "Unknown"
        : "N/A";

      const row = [
        rollNumber,
        `"${name.replace(/"/g, '""')}"`, // Escape quotes in name
        `"${hostelName}"`,
        `"${currentMessName}"`,
      ].join(",");
      csvContent += row + "\n";
    });

    const outputPath = path.join(__dirname, "../mess_changers.csv");
    fs.writeFileSync(outputPath, csvContent);
    console.log(`\n✅ CSV exported successfully to: ${outputPath}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    if (mongoose.connection) await mongoose.connection.close();
  }
}

exportMessChangers();
