const schedule = require("node-schedule");
const { FeedbackSettings } = require("./feedbackSettingsModel");
const {
  enableFeedbackAutomatic,
  disableFeedbackAutomatic,
} = require("./feedbackController");
const { User } = require("../user/userModel");
const {
  sendNotificationMessage,
} = require("../notification/notificationController");

// Helper to get feedback window dates for a given month
// Server is already in IST timezone, so we use local time
const getFeedbackWindowDates = (targetMonth = null, targetYear = null) => {
  const now = new Date();
  const year = targetYear || now.getFullYear();
  const month = targetMonth !== null ? targetMonth : now.getMonth(); // 0-11

  let startDay, endDay;

  if (month === 1) {
    // February
    startDay = 23;
    endDay = 25;
  } else {
    // All other months
    startDay = 25;
    endDay = 27;
  }

  // Create dates in local time (IST)
  // Start: 9 AM IST
  const startDate = new Date(year, month, startDay, 9, 0, 0);
  // End: 23:59:59 IST (end of day)
  const endDate = new Date(year, month, endDay, 23, 59, 59);

  return { startDate, endDate };
};

// Use controller implementations for enable/disable so scheduler doesn't
// duplicate business logic. They are imported from the controller below.

// Schedule reminder notifications
const scheduleFeedbackReminders = async () => {
  try {
    // Cancel any existing jobs for feedback reminders
    const existingJobs = schedule.scheduledJobs;
    Object.keys(existingJobs).forEach((jobName) => {
      if (jobName.startsWith("feedback-reminder-")) {
        existingJobs[jobName].cancel();
      }
    });

    const settings = await FeedbackSettings.findOne();
    if (!settings?.isEnabled || !settings.currentWindowClosingTime) {
      return;
    }

    const closingTime = new Date(settings.currentWindowClosingTime);
    const now = new Date();

    // 12 hours before closing (IST 11:59 AM on end day)
    const reminder12h = new Date(closingTime.getTime() - 12 * 60 * 60 * 1000);
    if (reminder12h > now) {
      const jobName12h = `feedback-reminder-12h-${Date.now()}`;
      schedule.scheduleJob(jobName12h, reminder12h, () => {
        sendNotificationMessage(
          "MESS FEEDBACK",
          "Feedback Submission form will close in 12 hours",
          "All_Hostels",
          { redirectType: "mess_screen", isAlert: "true" }
        ).catch((err) => console.error("📢 12h feedback reminder send failed:", err));
        console.log("📢 Sent 12h feedback reminder");
      });
      console.log(
        `📅 Scheduled 12h reminder for ${reminder12h.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}`
      );
    }

    // 2 hours before closing (IST 9:59 PM on end day)
    const reminder2h = new Date(closingTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      const jobName2h = `feedback-reminder-2h-${Date.now()}`;
      schedule.scheduleJob(jobName2h, reminder2h, () => {
        sendNotificationMessage(
          "MESS FEEDBACK",
          "Feedback Submission form will close in 2 hours",
          "All_Hostels",
          { redirectType: "mess_screen", isAlert: "true" }
        ).catch((err) => console.error("📢 2h feedback reminder send failed:", err));
        console.log("📢 Sent 2h feedback reminder");
      });
      console.log(
        `📅 Scheduled 2h reminder for ${reminder2h.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}`
      );
    }
  } catch (error) {
    console.error("❌ Error scheduling feedback reminders:", error);
  }
};

// Initialize feedback scheduler
const initializeFeedbackAutoScheduler = () => {
  console.log("🚀 Initializing automatic feedback scheduler...");

  // Schedule for feedback enable - runs daily at 9 AM IST
  schedule.scheduleJob("0 9 * * *", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    let startDay;
    if (month === 1) {
      startDay = 23; // February
    } else {
      startDay = 25; // Other months
    }

    // Check if today is the start date
    if (day === startDay) {
      console.log(
        `📅 Feedback start date detected: ${day}/${month + 1}/${year}`
      );
      await enableFeedbackAutomatic();
      await scheduleFeedbackReminders();
    }
  });

  // Schedule to disable at EOD - runs daily at 11:59 PM IST
  schedule.scheduleJob("59 23 * * *", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    let endDay;
    if (month === 1) {
      endDay = 25; // February
    } else {
      endDay = 27; // Other months
    }

    // Check if today is the end date
    if (day === endDay) {
      console.log(`📅 Feedback end date detected: ${day}/${month + 1}/${year}`);
      const settings = await FeedbackSettings.findOne();
      if (settings?.isEnabled) {
        await disableFeedbackAutomatic();
      }
    }
  });

  console.log("✅ Automatic feedback scheduler initialized");
  // Schedule reminders if feedback is already enabled
  FeedbackSettings.findOne().then(async (settings) => {
    if (settings?.isEnabled) {
      await scheduleFeedbackReminders();
    }
  });
};

module.exports = {
  initializeFeedbackAutoScheduler,
  enableFeedbackAutomatic,
  disableFeedbackAutomatic,
  getFeedbackWindowDates,
};
