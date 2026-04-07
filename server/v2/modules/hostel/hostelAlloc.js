// upload.js
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Import Mongoose Models
const UserAllocHostel = require("./hostelAllocModel");
const { Hostel } = require("./hostelModel");

async function uploadData(req, res) {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        let processed = 0;
        let errors = 0;
        for (const row of results) {
          // Support different header names
          const rollRaw =
            row["Roll Number"] ||
            row["rollno"] ||
            row["rollNo"] ||
            row["roll"] ||
            row["Roll"] ||
            row["ROLL"];
          const hostelRaw =
            row["Hostel"] ||
            row["hostelName"] ||
            row["hostel"] ||
            row["HOSTEL"];
          const currentSubscribedMessRaw =
            row["Current Subscribed Mess"] ||
            row["currentSubscribedMess"] ||
            row["current_subscribed_mess"] ||
            row["CURRENT_SUBSCRIBED_MESS"];

          const rollno = rollRaw ? String(rollRaw).trim() : "";
          const hostelName = hostelRaw ? String(hostelRaw).trim() : "";
          const currentSubscribedMessName = currentSubscribedMessRaw
            ? String(currentSubscribedMessRaw).trim()
            : "";
          if (!rollno || !hostelName) {
            errors++;
            continue;
          }

          try {
            const hostel = await Hostel.findOne({ hostel_name: hostelName });
            const currentSubscribedMess = await Hostel.findOne({
              hostel_name: currentSubscribedMessName,
            });
            if (!hostel) {
              // skip if hostel unknown
              errors++;
              continue;
            }

            const updateData = {
              rollno: rollno,
              hostel: hostel._id,
            };

            // Only set current_subscribed_mess if it was found
            if (currentSubscribedMess) {
              updateData.current_subscribed_mess = currentSubscribedMess._id;
            }

            await UserAllocHostel.findOneAndUpdate(
              { rollno: rollno },
              updateData,
              { upsert: true, new: true, runValidators: true }
            );

            processed++;
          } catch (err) {
            console.error(`Error processing roll no ${rollno}:`, err.message);
            errors++;
          }
        }

        // cleanup temp file
        fs.unlink(filePath, () => {});

        return res
          .status(200)
          .json({ message: "Allocation upload completed", processed, errors });
      })
      .on("error", (err) => {
        console.error("CSV parse error", err);
        return res.status(500).json({ message: "CSV parse error" });
      });
  } catch (error) {
    console.error("Failed to upload allocation CSV:", error);
    return res.status(500).json({ message: "Failed to upload allocation CSV" });
  }
}

module.exports = { uploadData };
