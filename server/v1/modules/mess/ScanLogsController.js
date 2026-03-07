const { ScanLogs } = require("./ScanLogsModel.js");
const mongoose = require("mongoose");

//For getting count of people who have eaten breakfast, lunch and dinner
const statsByDate = async (req, res) => {
  try {
    const date = req.params.date;
    const messid = req.query.messId;

    const matchStage = { date: date };
    if (messid) {
      if (!mongoose.Types.ObjectId.isValid(messid)) {
        return res.status(400).json({ message: "Invalid Mess ID format" });
      }
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
          totalScans: { $sum: 1 }
        }
      }
    ]);

    const stats = { total: 0, breakfast: 0, lunch: 0, dinner: 0, highest: ["", 0], lowest: ["", 0] };

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
      const attendanceNum = ((messStat.breakfast + messStat.lunch + messStat.dinner) / (messStat.totalScans * 3)) * 100;
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
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

//temporary function for creating sample logs
const createLogs = async (req, res) => {
  try {
    const logsdata = req.body;
    const insertedlogs = await ScanLogs.insertMany(logsdata);
    res.status(200).json({
      message: "Successfully inserted the data!",
      data: insertedlogs,
    })
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

//temporary function for deleting sample logs
const deleteall = async (req, res) => {
  try {
    await ScanLogs.deleteMany();
    res.status(200).json({
      message: "Successfulyy deleted everything!",
    })
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Get total count of all scan logs
const getTotalScanLogsCount = async (req, res) => {
  try {
    const totalCount = await ScanLogs.countDocuments({});
    res.status(200).json({ total: totalCount });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  statsByDate,
  createLogs,
  deleteall,
  getTotalScanLogsCount
}