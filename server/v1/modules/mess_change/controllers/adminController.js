const { User } = require("../../user/userModel.js");
const { MessChangeSettings } = require("../messChangeSettingsModel.js");
const {
  sendNotificationMessage,
} = require("../../notification/notificationController.js");

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
 * Enable mess change
 */
const enableMessChange = async (req, res) => {
  try {
    let settings = await MessChangeSettings.findOne();

    if (!settings) {
      settings = new MessChangeSettings({
        isEnabled: true,
        enabledAt: new Date(),
      });
    } else {
      settings.isEnabled = true;
      settings.enabledAt = new Date();
      settings.disabledAt = null;
    }

    await settings.save();

    sendNotificationMessage(
      "MESS CHANGE",
      "Mess Change for this month has been enabled",
      "All_Hostels",
      { redirectType: "mess_change", isAlert: "true" },
    ).catch((err) => console.error("Mess change enabled notification failed:", err));

    return res.status(200).json({
      message: "Mess change enabled successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error enabling mess change:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Disable mess change
 */
const disableMessChange = async (req, res) => {
  try {
    let settings = await MessChangeSettings.findOne();

    if (!settings) {
      return res
        .status(404)
        .json({ message: "Mess change settings not found" });
    }

    settings.isEnabled = false;
    settings.disabledAt = new Date();

    await settings.save();

    return res.status(200).json({
      message: "Mess change disabled successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error disabling mess change:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get mess change schedule information
 */
const getMessChangeScheduleInfo = async (req, res) => {
  try {
    const settings = await MessChangeSettings.findOne();

    // FOR TESTING: Fixed test dates
    const testEnableDate = new Date("2025-09-07T02:48:00+05:30");
    const testDisableDate = new Date("2025-09-07T04:30:00+05:30");

    return res.status(200).json({
      message: "Mess change schedule information (TEST MODE)",
      data: {
        currentSettings: settings,
        schedule: {
          enablePattern: "TEST: 7 Sept 2025 at 2:15 AM IST",
          disablePattern: "TEST: 7 Sept 2025 at 2:30 AM IST",
          nextEnableDate: testEnableDate.toISOString(),
          nextDisableDate: testDisableDate.toISOString(),
          nextEnableDateIST: testEnableDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
          nextDisableDateIST: testDisableDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
          isTestMode: true,
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
  enableMessChange,
  disableMessChange,
  getMessChangeScheduleInfo,
};
