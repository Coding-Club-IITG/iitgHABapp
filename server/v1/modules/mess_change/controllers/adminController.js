const { User } = require("../../user/userModel.js");
const { MessChangeSettings } = require("../messChangeSettingsModel.js");
const {
  getMessChangeWindowDates,
  getOrdinalSuffix,
} = require("../../../utils/windowDates.js");

/**
 * Get all mess change requests for all hostels
 */
const getAllMessChangeRequestsForAllHostels = async (req, res) => {
  try {
    const messChangeRequests = await User.find({
      applied_for_mess_changed: true,
    }).select(
      "name rollNumber curr_subscribed_mess hostel next_mess1 next_mess2 next_mess3 applied_hostel_string applied_hostel_timestamp",
    );

    // Return empty array instead of 404 when no requests found
    return res.status(200).json({
      message: "Mess change requests fetched successfully",
      data: messChangeRequests || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get mess change status for admin
 */
const messChangeStatusForAdmin = async (req, res) => {
  try {
    let settings = await MessChangeSettings.findOne();

    if (!settings) {
      settings = new MessChangeSettings({
        isEnabled: false,
        enabledAt: null,
        disabledAt: null,
        lastProcessedAt: null,
      });
      await settings.save();
    }

    return res.status(200).json({
      message: "Mess change status fetched successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching mess change status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get mess change schedule information
 */
const getMessChangeScheduleInfo = async (req, res) => {
  try {
    const settings = await MessChangeSettings.findOne();

    const now = new Date();
    let month = now.getMonth();
    let year = now.getFullYear();

    let { startDate, endDate, startDay, endDay } = getMessChangeWindowDates(
      month,
      year,
    );

    // If we've already passed this month's window, show next month's window
    if (now > endDate) {
      if (month === 11) {
        month = 0;
        year += 1;
      } else {
        month += 1;
      }
      ({ startDate, endDate, startDay, endDay } = getMessChangeWindowDates(
        month,
        year,
      ));
    }

    return res.status(200).json({
      message: "Mess change schedule information",
      data: {
        currentSettings: settings,
        schedule: {
          enablePattern: `${getOrdinalSuffix(startDay)}-${getOrdinalSuffix(endDay)} at 9:00 AM IST`,
          disablePattern: `End of day on ${getOrdinalSuffix(endDay)} IST`,
          nextEnableDate: startDate.toISOString(),
          nextDisableDate: endDate.toISOString(),
          nextEnableDateIST: startDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
          nextDisableDateIST: endDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
        },
        currentTimeIST: new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
      },
    });
  } catch (error) {
    console.error("Error fetching mess change schedule info:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getAllMessChangeRequestsForAllHostels,
  messChangeStatusForAdmin,
  getMessChangeScheduleInfo,
};
