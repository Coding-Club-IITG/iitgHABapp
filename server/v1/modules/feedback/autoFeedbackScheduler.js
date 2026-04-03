// autoFeedbackScheduler.js

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
const admin = require("../notification/firebase");
const { FCMToken } = require("../notification/FCMToken");

/**
 * Sends a targeted reminder only to students who haven't filled out the active feedback.
 * @param {number} hoursLeft - The number of hours remaining.
 */
const sendFeedbackReminder = async (hoursLeft) => {
  try {
    // 1. Find all users who have NOT filled out the current active feedback
    // (Note: Ensure 'hasFilledCurrentFeedback' matches your actual boolean in userModel)
    const slackers = await User.find({ hasFilledCurrentFeedback: false }).select('_id');
    
    if (slackers.length === 0) {
      console.log(`No feedback reminders needed for ${hoursLeft}hr mark.`);
      return; 
    }

    const userIds = slackers.map(u => u._id);

    // 2. Fetch their device tokens
    const tokens = await FCMToken.find({ user: { $in: userIds } }).select('token');
    const tokenArray = tokens.map(t => t.token);

    if (tokenArray.length === 0) return;

    // 3. Blast the Multicast using the Feedback Native Channel ID
    const response = await admin.messaging().sendMulticast({
      tokens: tokenArray,
      notification: {
        title: "Feedback Closing Soon! ⚠️",
        body: `You only have ${hoursLeft} hours left to submit your mess feedback.`,
      },
      android: {
        notification: {
          channelId: "hab_feedback_reminders" // Allows users to mute this category in Android settings
        }
      }
    });

    console.log(`Sent ${hoursLeft}hr feedback reminder to ${response.successCount} users.`);
  } catch (error) {
    console.error("Error sending feedback reminders:", error);
  }
};

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
      // schedule.scheduleJob(jobName12h, reminder12h, () => {
      //   sendNotificationMessage(
      //     "MESS FEEDBACK",
      //     "Feedback Submission form will close in 12 hours",
      //     "All_Hostels",
      //     { redirectType: "mess_screen", isAlert: "true" },
      //   ).catch((err) =>
      //     console.error("📢 12h feedback reminder send failed:", err),
      //   );
      //   console.log("📢 Sent 12h feedback reminder");
      // });
      schedule.scheduleJob(jobName12h, reminder12h, () => {
        sendFeedbackReminder(12);
      });
      console.log(
        `📅 [FEEDBACK] Scheduled 12h reminder for ${reminder12h.toLocaleString(
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
      const jobName2h = `feedback-reminder-2h-${Date.now()}`;
      // schedule.scheduleJob(jobName2h, reminder2h, () => {
      //   sendNotificationMessage(
      //     "MESS FEEDBACK",
      //     "Feedback Submission form will close in 2 hours",
      //     "All_Hostels",
      //     { redirectType: "mess_screen", isAlert: "true" },
      //   ).catch((err) =>
      //     console.error("📢 [FEEDBACK] 2h feedback reminder send failed:", err),
      //   );
      //   console.log("📢 [FEEDBACK] Sent 2h feedback reminder");
      // });
      schedule.scheduleJob(jobName2h, reminder2h, () => {
        sendFeedbackReminder(2);
      });
      console.log(
        `📅 [FEEDBACK] Scheduled 2h reminder for ${reminder2h.toLocaleString(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
          },
        )}`,
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
        `📅 Feedback start date detected: ${day}/${month + 1}/${year}`,
      );
      await enableFeedbackAutomatic();
      await scheduleFeedbackReminders();
    }
  });

  // Schedule to close the window - runs daily at 12:01 AM IST
  schedule.scheduleJob("1 0 * * *", async () => {
    try {
      const settings = await FeedbackSettings.findOne();
      if (settings?.isEnabled && settings.currentWindowClosingTime) {
        if (new Date() > new Date(settings.currentWindowClosingTime)) {
          console.log(`📅 Feedback closing time reached, disabling now.`);
          await disableFeedbackAutomatic();
        }
      }
    } catch (e) {
      console.error("❌ Error in automatic feedback closing job:", e);
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
