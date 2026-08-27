import { logger } from "../../logging/logger.js";
import fs from "fs";
import csv from "csv-parser";

import UserAllocHostel from "./hostelAllocModel.js";
import { Hostel } from "./hostelModel.js";
import { SummerMessSettings } from "../summer_mess/summerMessSettingsModel.js";

async function resolveDefaultSubscribedMess(hostelId, currentSubscribedMessId = null) {
  if (currentSubscribedMessId) return currentSubscribedMessId;

  const activeSummerSeason = await SummerMessSettings.findOne({
    isSummerActive: true,
  })
    .select("_id")
    .lean();

  if (activeSummerSeason) {
    return null;
  }

  return hostelId;
}

export async function getAllocations(req, res) {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (search) {
      query.rollno = { $regex: search, $options: "i" };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const allocations = await UserAllocHostel.find(query)
      .populate("hostel", "hostel_name")
      .populate("current_subscribed_mess", "hostel_name")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rollno: 1 });
      
    const totalCount = await UserAllocHostel.countDocuments(query);
    
    return res.status(200).json({
      allocations,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    logger.error("Error fetching allocations:", { error: error });
    return res.status(500).json({ message: "Failed to fetch allocations" });
  }
}

export async function updateAllocation(req, res) {
  try {
    const { id } = req.params;
    const { email } = req.body;
    
    const updated = await UserAllocHostel.findByIdAndUpdate(
      id,
      { $set: { email: email ? email.trim() : null } },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: "Allocation not found" });
    }
    
    return res.status(200).json({ message: "Allocation updated", allocation: updated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists in another allocation" });
    }
    logger.error("Error updating allocation:", { error: error });
    return res.status(500).json({ message: "Failed to update allocation" });
  }
}

export async function upsertAllocation(req, res) {
  try {
    const { rollno, hostelId, currentSubscribedMessId, email } = req.body || {};

    const roll = String(rollno || "").trim();
    const hostelIdStr = String(hostelId || "").trim();
    const emailStr = String(email || "").trim();
    const currentMessIdStr = String(currentSubscribedMessId || "").trim();

    if (!roll || !hostelIdStr) {
      return res.status(400).json({
        message: "rollno and hostelId are required",
      });
    }

    const hostel = await Hostel.findById(hostelIdStr).select("_id").lean();
    if (!hostel) {
      return res.status(400).json({ message: "Invalid hostelId" });
    }

    let currentSubscribedMess = null;
    if (currentMessIdStr) {
      currentSubscribedMess = await Hostel.findById(currentMessIdStr)
        .select("_id")
        .lean();
      if (!currentSubscribedMess) {
        return res.status(400).json({ message: "Invalid currentSubscribedMessId" });
      }
    }

    const resolvedSubscribedMess = await resolveDefaultSubscribedMess(
      hostel._id,
      currentSubscribedMess?._id ?? null,
    );

    const updateData = {
      rollno: roll,
      hostel: hostel._id,
      current_subscribed_mess: resolvedSubscribedMess,
    };

    // Optional email
    if (emailStr) {
      updateData.email = emailStr.toLowerCase();
    } else {
      updateData.email = null;
    }

    const updated = await UserAllocHostel.findOneAndUpdate(
      { rollno: roll },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true },
    )
      .populate("hostel", "hostel_name")
      .populate("current_subscribed_mess", "hostel_name");

    return res.status(200).json({
      message: "Allocation upserted",
      allocation: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate key: roll number or email already exists",
      });
    }
    logger.error("Error upserting allocation:", { error: error });
    return res.status(500).json({ message: "Failed to upsert allocation" });
  }
}

export async function uploadData(req, res) {
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
          const emailRaw = row["Email"] || row["email"] || row["EMAIL"];

          const rollno = rollRaw ? String(rollRaw).trim() : "";
          const hostelName = hostelRaw ? String(hostelRaw).trim() : "";
          const email = emailRaw ? String(emailRaw).trim() : "";
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

            const resolvedSubscribedMess = await resolveDefaultSubscribedMess(
              hostel._id,
              currentSubscribedMess?._id ?? null,
            );

            const updateData = {
              rollno: rollno,
              hostel: hostel._id,
              current_subscribed_mess: resolvedSubscribedMess,
            };

            if (email) {
              updateData.email = email;
            }

            await UserAllocHostel.findOneAndUpdate(
              { rollno: rollno },
              updateData,
              { upsert: true, new: true, runValidators: true },
            );

            processed++;
          } catch (err) {
            logger.error("Hostel allocation row processing failed", { error: err });
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
        logger.error("CSV parse error", { error: err });
        return res.status(500).json({ message: "CSV parse error" });
      });
  } catch (error) {
    logger.error("Failed to upload allocation CSV:", { error: error });
    return res.status(500).json({ message: "Failed to upload allocation CSV" });
  }
}
