const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { User } = require("../modules/user/userModel.js");
const { Hostel } = require("../modules/hostel/hostelModel.js");
const UserAllocHostel = require("../modules/hostel/hostelAllocModel.js");

async function exportDumps() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    // Fetch hostels to map IDs to names
    const hostels = await Hostel.find({});
    const hostelMap = {};
    const hostelStats = {};

    hostels.forEach((h) => {
      hostelMap[h._id.toString()] = h.hostel_name;
      hostelStats[h._id.toString()] = {
        name: h.hostel_name,
        boarderCount: 0,
        subscriberCount: 0,
      };
    });

    // Fetch all allocated users for counts
    console.log("Fetching all allocated users...");
    const allocatedUsers = await UserAllocHostel.find({});
    console.log(`Found ${allocatedUsers.length} allocated users.`);

    // Update counts for boarders and subscribers using UserAllocHostel
    allocatedUsers.forEach((au) => {
      // Boarders (based on the hostel field)
      if (au.hostel) {
        const hostelIdStr = au.hostel.toString();
        if (hostelStats[hostelIdStr]) {
          hostelStats[hostelIdStr].boarderCount++;
        }
      }

      // Subscribers (based on the current_subscribed_mess field)
      if (au.current_subscribed_mess) {
        const messIdStr = au.current_subscribed_mess.toString();
        if (hostelStats[messIdStr]) {
          hostelStats[messIdStr].subscriberCount++;
        }
      }
    });

    // Fetch all users for the general dump, excluding guests and those without valid roll numbers
    console.log("Fetching users for status dump...");
    const users = await User.find({
      authProvider: { $ne: "guest" },
      rollNumber: { $exists: true, $nin: [null, "", "DELETED"] },
    });
    console.log(`Found ${users.length} valid users.`);

    // CSV 1: USER STATS
    let usersCsvContent = "\ufeff"; // BOM for Excel UTF-8
    usersCsvContent +=
      "Roll Number,Name,Hostel,Current Subscribed Mess,Mess Changed?\n";

    // Use a map for quick lookup of got_mess_changed if needed
    // But we already have it in the User model
    users.forEach((u) => {
      const hostelName = u.hostel
        ? hostelMap[u.hostel.toString()] || "Unknown"
        : "N/A";
      const messName = u.curr_subscribed_mess
        ? hostelMap[u.curr_subscribed_mess.toString()] || "Unknown"
        : "N/A";
      const messChanged = u.got_mess_changed ? "Yes" : "No";

      const row = [
        u.rollNumber || "",
        `"${u.name || ""}"`,
        `"${hostelName}"`,
        `"${messName}"`,
        messChanged,
      ].join(",");
      usersCsvContent += row + "\n";
    });

    const usersPath = path.join(__dirname, "../../user_stats.csv");
    fs.writeFileSync(usersPath, usersCsvContent);
    console.log(`✅ Dumped user stats to: ${usersPath}`);

    // CSV 2: HOSTEL STATS
    let hostelCsvContent = "\ufeff"; // BOM for Excel UTF-8
    hostelCsvContent +=
      "Hostel Name,No. of boarders,Number of mess subscribers,Delta\n";

    Object.values(hostelStats).forEach((h) => {
      const delta = h.subscriberCount - h.boarderCount;
      const row = [
        `"${h.name}"`,
        h.boarderCount,
        h.subscriberCount,
        delta,
      ].join(",");
      hostelCsvContent += row + "\n";
    });

    const hostelPath = path.join(__dirname, "../../hostel_stats.csv");
    fs.writeFileSync(hostelPath, hostelCsvContent);
    console.log(`✅ Dumped hostel stats to: ${hostelPath}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    if (mongoose.connection) await mongoose.connection.close();
  }
}

exportDumps();
