const schedule = require("node-schedule");
const { MessChangeSettings } = require("./messChangeSettingsModel");
const {
  enableMessChangeAutomatic,
  disableMessChangeAutomatic,
} = require("./controllers/schedulerController");
const {
  sendNotificationMessage,
} = require("../notification/notificationController");
const { getMessChangeWindowDates } = require("../../utils/windowDates.js");

// Schedule reminder notifications
const scheduleMessChangeReminders = async () => {
  try {
    // Cancel any existing jobs for mess change reminders
    const existingJobs = schedule.scheduledJobs;
    Object.keys(existingJobs).forEach((jobName) => {
      if (jobName.startsWith("messchange-reminder-")) {
        existingJobs[jobName].cancel();
      }
    });

    const settings = await MessChangeSettings.findOne();
    if (!settings?.isEnabled || !settings.enabledAt) {
      return;
    }

    // Get closing time
    const { endDate } = getMessChangeWindowDates();
    const closingTime = endDate;

    const now = new Date();

    // 12 hours before closing (IST 11:59 AM on end day)
    const reminder12h = new Date(closingTime.getTime() - 12 * 60 * 60 * 1000);
    if (reminder12h > now) {
      const jobName12h = `messchange-reminder-12h-${Date.now()}`;
      schedule.scheduleJob(jobName12h, reminder12h, () => {
        sendNotificationMessage(
          "MESS CHANGE",
          "Mess change application form will close in 12 hours",
          "All_Hostels",
          { redirectType: "mess_change", isAlert: "true" },
        ).catch((err) =>
          console.error(
            "📢 [MESS CHANGE] 12h mess change reminder send failed:",
            err,
          ),
        );
        console.log("📢 [MESS CHANGE] Sent 12h mess change reminder");
      });
      console.log(
        `📅 [MESS CHANGE] Scheduled 12h reminder for ${reminder12h.toLocaleString(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
          },
        )}`,
      );
    }

    // 2 hours before closing (IST 9:59 PM on end day)
    const reminder2h = new Date(closingTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      const jobName2h = `messchange-reminder-2h-${Date.now()}`;
      schedule.scheduleJob(jobName2h, reminder2h, () => {
        sendNotificationMessage(
          "MESS CHANGE",
          "Mess change application form will close in 2 hours",
          "All_Hostels",
          { redirectType: "mess_change", isAlert: "true" },
        ).catch((err) =>
          console.error(
            "📢 [MESS CHANGE] 2h mess change reminder send failed:",
            err,
          ),
        );
        console.log("📢 [MESS CHANGE] Sent 2h mess change reminder");
      });
      console.log(
        `📅 [MESS CHANGE] Scheduled 2h reminder for ${reminder2h.toLocaleString(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
          },
        )}`,
      );
    }
  } catch (error) {
    console.error("❌ Error scheduling mess change reminders:", error);
  }
};

// Initialize mess change scheduler
const initializeMessChangeAutoScheduler = () => {
  console.log("🚀 Initializing automatic mess change scheduler...");

  // Schedule for mess change enable - runs daily at 9 AM IST
  schedule.scheduleJob("0 9 * * *", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const { startDate, endDate } = getMessChangeWindowDates(month, year);

    // Check if today is the start date
    if (day === startDate.getDate()) {
      console.log(
        `📅 Mess change start date detected: ${day}/${month + 1}/${year}`,
      );
      await enableMessChangeAutomatic(endDate);
      await scheduleMessChangeReminders();
    }
  });

  // Schedule to disable - runs daily at 12:01 AM IST
  schedule.scheduleJob("1 0 * * *", async () => {
    try {
      const settings = await MessChangeSettings.findOne();
      if (settings?.isEnabled && settings.currentWindowClosingTime) {
        if (new Date() > new Date(settings.currentWindowClosingTime)) {
          console.log(`📅 Mess change closing time reached, disabling now.`);
          await disableMessChangeAutomatic();
        }
      }
    } catch (e) {
      console.error("❌ Error in automatic mess change closing job:", e);
    }
  });

  console.log("✅ Automatic mess change scheduler initialized");
  // Schedule reminders if mess change is already enabled
  MessChangeSettings.findOne().then(async (settings) => {
    if (settings?.isEnabled) {
      await scheduleMessChangeReminders();
    }
  });
};

module.exports = {
  initializeMessChangeAutoScheduler,
  getMessChangeWindowDates,
};
