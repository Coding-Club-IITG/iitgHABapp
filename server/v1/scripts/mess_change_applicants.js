// Run before Mess Change processing to test

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { User } = require("../modules/user/userModel.js");
const { Hostel } = require("../modules/hostel/hostelModel.js");

async function exportCSV() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    // Fetch hostels to map IDs to names
    const hostels = await Hostel.find({});
    const hostelMap = {};
    hostels.forEach((h) => {
      hostelMap[h._id.toString()] = h.hostel_name;
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    console.log(
      `Filtering for month: ${currentMonth + 1}, year: ${currentYear}`,
    );

    // Get users who applied for mess change
    const users = await User.find({ applied_for_mess_changed: true });

    // Filter users who applied this month
    const applicants = users.filter((u) => {
      if (!u.applied_hostel_timestamp) return false;
      const d = new Date(u.applied_hostel_timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    console.log(`Found ${applicants.length} applicants for this month.`);

    if (applicants.length === 0) {
      console.log("No applicants found for this month.");
      // Checking all users with applied_for_mess_changed: true if none found for this month
      if (users.length > 0) {
        console.log(
          `Total users with applied_for_mess_changed=true: ${users.length}`,
        );
        console.log("Sample timestamp:", users[0].applied_hostel_timestamp);
      }
      await mongoose.connection.close();
      return;
    }

    // CSV Header
    let csvContent = "\ufeff"; // BOM for Excel UTF-8
    csvContent +=
      "Roll Number,User Name,Email ID,Next Mess 1,Next Mess 2,Next Mess 3,Application Timestamp\n";

    applicants.forEach((u) => {
      const next1 = u.next_mess1
        ? hostelMap[u.next_mess1.toString()] || u.next_mess1
        : "";
      const next2 = u.next_mess2
        ? hostelMap[u.next_mess2.toString()] || u.next_mess2
        : "";
      const next3 = u.next_mess3
        ? hostelMap[u.next_mess3.toString()] || u.next_mess3
        : "";
      const timestamp = u.applied_hostel_timestamp
        ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "";

      const row = [
        u.rollNumber || "",
        `"${u.name || ""}"`,
        u.email || "",
        `"${next1}"`,
        `"${next2}"`,
        `"${next3}"`,
        `"${timestamp}"`,
      ].join(",");
      csvContent += row + "\n";
    });

    const outputPath = path.join(__dirname, "../mess_applicants_report.csv");
    fs.writeFileSync(outputPath, csvContent);
    console.log(`\n✅ CSV exported successfully to: ${outputPath}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    if (mongoose.connection) await mongoose.connection.close();
  }
}

exportCSV();
