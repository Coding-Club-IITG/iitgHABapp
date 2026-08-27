import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";
import { ScanLogs } from "./ScanLogsModel.js";
import { getCurrentDate, getCurrentDay, getCurrentTime } from "../../utils/date.js";
import { publishMessScan } from "../../utils/scanBroadcast.js";
import { Menu } from "./menuModel.js";
import { User } from "../user/userModel.js";

// For getting count of people who have eaten breakfast, lunch and dinner
export const statsByDate = async (req, res) => {
  try {
    const date = req.params.date;
    const messid = req.query.messId;

    const matchStage = { date: date };
    if (messid) {
      matchStage.messId = new mongoose.Types.ObjectId(messid);
    }

    const aggregatedStats = await ScanLogs.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$messId",
          breakfast: { $sum: { $cond: ["$breakfast", 1, 0] } },
          lunch: { $sum: { $cond: ["$lunch", 1, 0] } },
          dinner: { $sum: { $cond: ["$dinner", 1, 0] } },
          totalScans: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: 0,
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      highest: ["", 0],
      lowest: ["", 0],
    };

    if (aggregatedStats.length === 0) {
      return res.status(200).json(stats);
    }

    let highestAttendance = -1;
    let lowestAttendance = 101;

    aggregatedStats.forEach((messStat) => {
      stats.breakfast += messStat.breakfast;
      stats.lunch += messStat.lunch;
      stats.dinner += messStat.dinner;
      stats.total += messStat.totalScans;

      // 3 possible meals per user per day
      const attendanceNum =
        ((messStat.breakfast + messStat.lunch + messStat.dinner) /
          (messStat.totalScans * 3)) *
        100;
      const attendanceStr = attendanceNum.toFixed(1);

      if (stats.highest[0] === "" || attendanceNum > highestAttendance) {
        highestAttendance = attendanceNum;
        stats.highest = [messStat._id.toString(), attendanceStr];
      }
      if (stats.lowest[0] === "" || attendanceNum < lowestAttendance) {
        lowestAttendance = attendanceNum;
        stats.lowest = [messStat._id.toString(), attendanceStr];
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    logger.error("Operation failed", { error: error });
    return res.status(500).json({ message: "Internal server error" });
  }
};

//temporary function for creating sample logs
export const createLogs = async (req, res) => {
  try {
    const logsdata = req.body;
    const insertedlogs = await ScanLogs.insertMany(logsdata);
    res.status(200).json({
      message: "Successfully inserted the data!",
      data: insertedlogs,
    });
  } catch (error) {
    logger.error("Operation failed", { error: error });
    return res.status(500).json({ message: "Internal server error" });
  }
};

//temporary function for deleting sample logs
export const deleteall = async (req, res) => {
  try {
    await ScanLogs.deleteMany();
    res.status(200).json({
      message: "Successfulyy deleted everything!",
    });
  } catch (error) {
    logger.error("Operation failed", { error: error });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get total count of all scan logs
export const getTotalScanLogsCount = async (req, res) => {
  try {
    const totalCount = await ScanLogs.countDocuments({});
    res.status(200).json({ total: totalCount });
  } catch (error) {
    logger.error("Operation failed", { error: error });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Mess-manager (HABit HQ): summary for today's scans for the manager's mess.
// Requires authenticateMessManagerJWT to set req.managerHostel with populated messId.
export const getManagerTodaySummary = async (req, res) => {
  try {
    const managerHostel = req.managerHostel;
    if (!managerHostel || !managerHostel.messId) {
      return res
        .status(400)
        .json({ message: "Manager hostel or messId not found" });
    }

    const messId =
      managerHostel.messId._id?.toString() || managerHostel.messId.toString();
    const today = getCurrentDate(); // "YYYY-MM-DD"

    const logs = await ScanLogs.find({
      date: today,
      messId,
    })
      .populate("userId", "name rollNumber")
      .lean();

    const totals = { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
    const recent = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };

    logs.forEach((log) => {
      const user = log.userId || {};
      const base = {
        userId: user._id || user.id || log.userId,
        name: user.name || "",
        rollNumber: user.rollNumber || "",
      };

      if (log.breakfast) {
        totals.breakfast += 1;
        totals.total += 1;
        if (log.breakfastTime) {
          recent.breakfast.push({
            ...base,
            time: log.breakfastTime,
          });
        }
      }
      if (log.lunch) {
        totals.lunch += 1;
        totals.total += 1;
        if (log.lunchTime) {
          recent.lunch.push({
            ...base,
            time: log.lunchTime,
          });
        }
      }
      if (log.dinner) {
        totals.dinner += 1;
        totals.total += 1;
        if (log.dinnerTime) {
          recent.dinner.push({
            ...base,
            time: log.dinnerTime,
          });
        }
      }
    });

    const sortByTimeDesc = (arr) =>
      arr.sort((a, b) => new Date(b.time) - new Date(a.time));
    sortByTimeDesc(recent.breakfast);
    sortByTimeDesc(recent.lunch);
    sortByTimeDesc(recent.dinner);

    return res.status(200).json({
      date: today,
      messId,
      totals,
      recent,
    });
  } catch (error) {
    logger.error("getManagerTodaySummary:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * Mess-manager (HABit HQ): create a scan log for a selected user/date/meal.
 * POST /api/logs/manager/entry
 * Body: { userId: string, mealType: "Breakfast"|"Lunch"|"Dinner", date?: "YYYY-MM-DD" }
 */
export const managerCreateScanEntry = async (req, res) => {
  try {
    const managerHostel = req.managerHostel;
    if (!managerHostel || !managerHostel._id || !managerHostel.messId) {
      return res
        .status(400)
        .json({ success: false, message: "Manager hostel not found" });
    }

    const { userId, mealType, date } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res
        .status(400)
        .json({ success: false, message: "Valid userId is required" });
    }

    const meal = String(mealType || "").trim();
    if (!["Breakfast", "Lunch", "Dinner"].includes(meal)) {
      return res.status(400).json({
        success: false,
        message: "mealType must be Breakfast, Lunch, or Dinner",
      });
    }

    const targetDate = (String(date || "") || getCurrentDate()).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({
        success: false,
        message: "date must be YYYY-MM-DD",
      });
    }

    const hostelId = managerHostel._id.toString();
    const messId =
      managerHostel.messId._id?.toString() || managerHostel.messId.toString();

    const user = await User.findById(userId)
      .select("_id name rollNumber curr_subscribed_mess scannerPermission")
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (
      !user.curr_subscribed_mess ||
      user.curr_subscribed_mess.toString() !== hostelId
    ) {
      return res.status(403).json({
        success: false,
        message: "User is not subscribed to this hostel/mess",
      });
    }
    if (user.scannerPermission === false) {
      return res
        .status(403)
        .json({ success: false, message: "Mess Rebate Active" });
    }

    let scanLog = await ScanLogs.findOne({
      userId,
      messId,
      date: targetDate,
    });
    if (!scanLog) {
      scanLog = new ScanLogs({
        userId,
        messId,
        date: targetDate,
        breakfast: false,
        lunch: false,
        dinner: false,
      });
    }

    const flag = meal.toLowerCase();
    const timeKey = `${flag}Time`;
    if (scanLog[flag] === true) {
      return res.status(200).json({
        success: false,
        message: `Already scanned for ${flag}`,
        mealType: meal,
        date: targetDate,
        time: scanLog[timeKey] || null,
      });
    }

    const kolkataTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    scanLog[flag] = true;
    scanLog[timeKey] = kolkataTime.toISOString();
    await scanLog.save();

    // Broadcast for live feed
    try {
      publishMessScan({
        hostelId,
        messId: messId.toString(),
        mealType: meal,
        user: {
          _id: user._id,
          name: user.name,
          rollNumber: user.rollNumber,
        },
        time: kolkataTime,
      });
    } catch (e) {
      logger.error("Failed to broadcast manager scan entry:", { error: e });
    }

    return res.status(200).json({
      success: true,
      message: "Entry added",
      mealType: meal,
      date: targetDate,
      time: kolkataTime.toISOString(),
      user: {
        _id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
      },
    });
  } catch (error) {
    logger.error("managerCreateScanEntry:", { error: error });
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mess-manager (HABit HQ): add a scan log entry for the ongoing meal.
 * POST /api/logs/manager/scan
 * Body: { rollNumber: string }
 *
 * Requires authenticateMessManagerJWT (req.managerHostel).
 */
export const managerAddOngoingMealScan = async (req, res) => {
  try {
    const managerHostel = req.managerHostel;
    if (!managerHostel || !managerHostel.messId) {
      return res
        .status(400)
        .json({ success: false, message: "Manager hostel or messId not found" });
    }

    const rollNumberRaw = (req.body?.rollNumber || "").toString().trim();
    if (!rollNumberRaw) {
      return res.status(400).json({
        success: false,
        message: "rollNumber is required",
      });
    }

    const rollRegex = new RegExp(`^${escapeRegex(rollNumberRaw)}$`, "i");
    const user = await User.findOne({ rollNumber: rollRegex })
      .select("_id name rollNumber curr_subscribed_mess scannerPermission")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.scannerPermission === false) {
      return res
        .status(403)
        .json({ success: false, message: "Mess Rebate Active" });
    }

    // Ensure the user belongs to this manager's hostel (subscribed to the mess/hostel)
    if (
      !user.curr_subscribed_mess ||
      user.curr_subscribed_mess.toString() !== managerHostel._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "User is not subscribed to this hostel/mess",
      });
    }

    const messId =
      managerHostel.messId._id?.toString() || managerHostel.messId.toString();
    const currentDate = getCurrentDate(); // YYYY-MM-DD (Kolkata)
    const currentDay = getCurrentDay(); // Monday...
    const currentTime = getCurrentTime(); // HH:mm

    const todayMenus = await Menu.find({
      messId,
      day: currentDay,
      type: { $in: ["Breakfast", "Lunch", "Dinner"] },
    }).lean();

    const breakfast = todayMenus.find((m) => m.type === "Breakfast");
    const lunch = todayMenus.find((m) => m.type === "Lunch");
    const dinner = todayMenus.find((m) => m.type === "Dinner");

    let mealType = null;
    if (
      breakfast &&
      currentTime >= breakfast.startTime &&
      currentTime <= breakfast.endTime
    ) {
      mealType = "Breakfast";
    } else if (
      lunch &&
      currentTime >= lunch.startTime &&
      currentTime <= lunch.endTime
    ) {
      mealType = "Lunch";
    } else if (
      dinner &&
      currentTime >= dinner.startTime &&
      currentTime <= dinner.endTime
    ) {
      mealType = "Dinner";
    }

    if (!mealType) {
      return res.status(400).json({
        success: false,
        message: "No meals available at this time",
        time: currentTime,
        date: currentDate,
      });
    }

    let scanLog = await ScanLogs.findOne({
      userId: user._id,
      messId,
      date: currentDate,
    });
    if (!scanLog) {
      scanLog = new ScanLogs({
        userId: user._id,
        messId,
        date: currentDate,
        breakfast: false,
        lunch: false,
        dinner: false,
      });
    }

    const flag = mealType.toLowerCase();
    const timeKey = `${flag}Time`;
    if (scanLog[flag] === true) {
      return res.status(200).json({
        success: false,
        message: `Already scanned for ${flag}`,
        mealType,
        time: scanLog[timeKey] || null,
        date: currentDate,
      });
    }

    const kolkataTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );

    scanLog[flag] = true;
    scanLog[timeKey] = kolkataTime.toISOString();
    await scanLog.save();

    // Broadcast to connected manager WebSocket clients
    try {
      publishMessScan({
        hostelId: managerHostel._id.toString(),
        messId: messId.toString(),
        mealType,
        user: {
          _id: user._id,
          name: user.name,
          rollNumber: user.rollNumber,
        },
        time: kolkataTime,
      });
    } catch (e) {
      logger.error("Failed to broadcast manager-added scan:", { error: e });
    }

    return res.status(200).json({
      success: true,
      message: "Scan added",
      mealType,
      time: kolkataTime.toISOString(),
      date: currentDate,
      user: {
        _id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
      },
    });
  } catch (error) {
    logger.error("managerAddOngoingMealScan:", { error: error });
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
