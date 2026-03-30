const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../../server/.env") });

const { User } = require("../modules/user/userModel.js");
const { Hostel } = require("../modules/hostel/hostelModel.js");
const {
  initializeCapacityTracker,
  processUsersInIterations,
} = require("../modules/mess_change/utils/messChangeLogic.js");

async function generateReport() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    // Fetch necessary data
    const hostels = await Hostel.find({});
    const users = await User.find({ applied_for_mess_changed: true });

    if (users.length === 0) {
      console.log("No mess change requests found in the database (v1).");
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`Found ${users.length} mess change requests.`);

    const capacityTracker = await initializeCapacityTracker(hostels);
    const { acceptedUsers, rejectedUsers } = await processUsersInIterations(
      users,
      capacityTracker,
    );

    // --- REPORT GENERATION ---
    const hostelMap = {};
    hostels.forEach((h) => (hostelMap[h._id.toString()] = h.hostel_name));

    let report = "MESS CHANGE DRY RUN REPORT\n";
    report += "Generated at: " + new Date().toLocaleString() + "\n";
    report += "========================================\n\n";

    report += "1. HOSTEL MESS SUBSCRIBERS SUMMARY\n";
    report += "----------------------------------\n";
    report +=
      String("Hostel Name").padEnd(25) +
      " | " +
      String("Initial").padEnd(8) +
      " | " +
      String("Final").padEnd(8) +
      " | " +
      String("Net").padEnd(6) +
      " | " +
      String("LowerCap").padEnd(10) +
      " | " +
      String("Limit(120%)").padEnd(12) +
      "\n";
    report += "-".repeat(90) + "\n";

    for (const id in capacityTracker) {
      const h = capacityTracker[id];
      const net = h.finalCount - h.initial;
      const netStr = net > 0 ? `+${net}` : `${net}`;
      report +=
        String(h.hostel_name).padEnd(25) +
        " | " +
        String(h.initial).padEnd(8) +
        " | " +
        String(h.finalCount).padEnd(8) +
        " | " +
        netStr.padEnd(6) +
        " | " +
        String(h.lowerCap).padEnd(10) +
        " | " +
        String(h.upperCap).padEnd(12) +
        "\n";
    }
    report += "\n";

    report += "2. ACCEPTED USERS (" + acceptedUsers.length + ")\n";
    report += "----------------------------------\n";
    report +=
      String("Name").padEnd(25) +
      " | " +
      String("Roll Number").padEnd(15) +
      " | " +
      String("From Mess").padEnd(25) +
      " | " +
      String("To Mess").padEnd(25) +
      "\n";
    report += "-".repeat(100) + "\n";

    for (const u of acceptedUsers) {
      const fromName = hostelMap[u.fromHostelId] || "None";
      const toName = hostelMap[u.toHostelId] || "Unknown";
      report +=
        String(u.name).padEnd(25) +
        " | " +
        String(u.rollNumber).padEnd(15) +
        " | " +
        fromName.padEnd(25) +
        " | " +
        toName.padEnd(25) +
        "\n";
    }
    report += "\n";

    report += "3. REJECTED USERS (" + rejectedUsers.length + ")\n";
    report += "----------------------------------\n";
    report +=
      String("Name").padEnd(25) +
      " | " +
      String("Roll Number").padEnd(15) +
      " | " +
      String("Current Host").padEnd(25) +
      "\n";
    report += "-".repeat(70) + "\n";

    for (const u of rejectedUsers) {
      const hostName = hostelMap[u.fromHostelId?.toString()] || "None";
      report +=
        String(u.name).padEnd(25) +
        " | " +
        String(u.rollNumber).padEnd(15) +
        " | " +
        hostName.padEnd(25) +
        "\n";
    }

    const outputPath = path.join(__dirname, "../mess_change_report.txt");
    fs.writeFileSync(outputPath, report);
    console.log(`\nReport generated successfully: ${outputPath}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error generating report:", error);
    if (mongoose.connection) await mongoose.connection.close();
  }
}

generateReport();
