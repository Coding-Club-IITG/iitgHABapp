const { FeedbackSettings } = require("./feedbackSettingsModel");
const {
  enableFeedbackAutomatic,
  disableFeedbackAutomatic,
} = require("./feedbackController");
const {
  sendNotificationMessage,
} = require("../notification/notificationController");
const { getFeedbackWindowDates } = require("../../utils/windowDates.js");
const agenda = require("../../utils/agenda.js");

const JOB_ENABLE = "feedback-enable-check";
const JOB_DISABLE = "feedback-disable-check";
const JOB_REMIND_12H = "feedback-reminder-12h";
const JOB_REMIND_2H = "feedback-reminder-2h";

// Schedule reminder notifications
const scheduleFeedbackReminders = async () => {
  try {
    const settings = await FeedbackSettings.findOne();
    if (!settings?.isEnabled || !settings.currentWindowClosingTime) return;

    const closingTime = new Date(settings.currentWindowClosingTime);
    const now = new Date();

    // Cancel any existing scheduled reminder jobs
    await agenda.cancel({ name: { $in: [JOB_REMIND_12H, JOB_REMIND_2H] } });

    // 12 hours before closing
    const reminder12h = new Date(closingTime.getTime() - 12 * 60 * 60 * 1000);
    if (reminder12h > now) {
      await agenda.schedule(reminder12h, JOB_REMIND_12H);
      console.log(
        `[FEEDBACK] Scheduled 12h reminder for ${reminder12h.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
    }

    // 2 hours before closing
    const reminder2h = new Date(closingTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      await agenda.schedule(reminder2h, JOB_REMIND_2H);
      console.log(
        `[FEEDBACK] Scheduled 2h reminder for ${reminder2h.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
    }
  } catch (error) {
    console.error("[FEEDBACK] Error scheduling reminders:", error);
  }
};

// Initialize feedback scheduler
const initializeFeedbackAutoScheduler = () => {
  // Runs daily at 9 AM IST
  agenda.define(JOB_ENABLE, async (job) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();

      const { startDate, endDate } = getFeedbackWindowDates(month, year);

      if (day === startDate.getDate()) {
        console.log(
          `[FEEDBACK] Start date detected: ${day}/${month + 1}/${year}`,
        );
        await enableFeedbackAutomatic(endDate);
        await scheduleFeedbackReminders();
      }
    } catch (e) {
      console.error("[FEEDBACK] Enable check job failed:", e);
      throw e;
    }
  }, { concurrency: 1 });

  // Runs daily at 12:01 AM IST
  agenda.define(JOB_DISABLE, async (job) => {
    try {
      const settings = await FeedbackSettings.findOne();
      if (settings?.isEnabled && settings.currentWindowClosingTime) {
        if (new Date() > new Date(settings.currentWindowClosingTime)) {
          console.log(`[FEEDBACK] Closing time reached, disabling now.`);
          await disableFeedbackAutomatic();
        }
      }
    } catch (e) {
      console.error("[FEEDBACK] Disable check job failed:", e);
      throw e;
    }
  }, { concurrency: 1 });

  // 12h reminder
  agenda.define(JOB_REMIND_12H, async (job) => {
    try {
      await sendNotificationMessage(
        "MESS FEEDBACK",
        "Feedback Submission form will close in 12 hours",
        "All_Hostels",
        { redirectType: "mess_screen", isAlert: "true" },
      );
      console.log("[FEEDBACK] Sent 12h reminder");
    } catch (err) {
      console.error("[FEEDBACK] 12h reminder job failed:", err);
      throw err;
    }
  }, { concurrency: 1 });

  // 2h reminder
  agenda.define(JOB_REMIND_2H, async (job) => {
    try {
      await sendNotificationMessage(
        "MESS FEEDBACK",
        "Feedback Submission form will close in 2 hours",
        "All_Hostels",
        { redirectType: "mess_screen", isAlert: "true" },
      );
      console.log("[FEEDBACK] Sent 2h reminder");
    } catch (err) {
      console.error("[FEEDBACK] 2h reminder job failed:", err);
      throw err;
    }
  }, { concurrency: 1 });

  // Set up recurring schedules
  agenda.every("0 9 * * *", JOB_ENABLE, {}, { timezone: "Asia/Kolkata" });
  agenda.every("1 0 * * *", JOB_DISABLE, {}, { timezone: "Asia/Kolkata" });

  console.log("[FEEDBACK] Scheduler initialized");

  // Restore reminders on boot if the window was already open before restart
  FeedbackSettings.findOne()
    .then(async (settings) => {
      if (settings?.isEnabled) {
        console.log(
          "[FEEDBACK] Feedback window already open, restoring reminder jobs",
        );
        await scheduleFeedbackReminders();
      }
    })
    .catch((err) =>
      console.error("[FEEDBACK] Boot-time reminder restore failed:", err),
    );
};

module.exports = {
  initializeFeedbackAutoScheduler,
  scheduleFeedbackReminders,
  enableFeedbackAutomatic,
  disableFeedbackAutomatic,
  getFeedbackWindowDates,
};
