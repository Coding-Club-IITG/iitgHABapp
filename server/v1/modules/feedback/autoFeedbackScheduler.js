import { logger } from "../../logging/logger.js";
import { FeedbackSettings } from "./feedbackSettingsModel.js";
import { User } from "../user/userModel.js";

import {
  enableFeedbackAutomatic,
  disableFeedbackAutomatic,
} from "./feedbackController.js";
import { sendNotificationToMultipleUsers } from "../notification/notificationController.js";

import { getFeedbackWindowDates } from "../../utils/windowDates.js";
import agenda from "../../utils/agenda.js";

const JOB_ENABLE = "feedback-enable-check";
const JOB_DISABLE = "feedback-disable-check";
const JOB_REMIND_12H = "feedback-reminder-12h";
const JOB_REMIND_2H = "feedback-reminder-2h";

/**
 * Sends a targeted reminder only to students who haven't filled out the active feedback
 * @param {number} hoursLeft - The number of hours remaining
 */
const sendFeedbackReminder = async (hoursLeft) => {
  try {
    // Find all users who have NOT filled out the current active feedback
    const slackers = await User.find({
      isFeedbackSubmitted: false,
    }).select("_id");

    if (slackers.length === 0) {
      logger.info("No feedback reminders needed");
      return;
    }

    const userIds = slackers.map((u) => u._id);

    const response = await sendNotificationToMultipleUsers(
      userIds,
      "Feedback Closing Soon! ⚠️",
      `You only have ${hoursLeft} hours left to submit your mess feedback.`,
      "hab_feedback_reminders",
    );

    logger.info(
      `[FEEDBACK] Sent ${hoursLeft}hr reminder to ${response.successCount} users`,
    );
  } catch (error) {
    logger.error("[FEEDBACK] Error sending reminders:", { error: error });
  }
};

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
      const job12 = agenda.create(JOB_REMIND_12H, {});
      job12.unique({ name: JOB_REMIND_12H });
      job12.schedule(reminder12h);
      await job12.save();
      logger.info(
        `[FEEDBACK] Scheduled 12h reminder for ${reminder12h.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
    }

    // 2 hours before closing
    const reminder2h = new Date(closingTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      const job2 = agenda.create(JOB_REMIND_2H, {});
      job2.unique({ name: JOB_REMIND_2H });
      job2.schedule(reminder2h);
      await job2.save();
      logger.info(
        `[FEEDBACK] Scheduled 2h reminder for ${reminder2h.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
    }
  } catch (error) {
    logger.error("[FEEDBACK] Error scheduling reminders:", { error: error });
  }
};

export const defineFeedbackJobs = () => {
  // Runs daily at 9 AM IST
  agenda.define(
    JOB_ENABLE,
    async (job) => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();

        const { startDate, endDate } = getFeedbackWindowDates(month, year);

        if (day === startDate.getDate()) {
          logger.info(
            `[FEEDBACK] Start date detected: ${day}/${month + 1}/${year}`,
          );
          await enableFeedbackAutomatic(endDate);
          await scheduleFeedbackReminders();
        }
      } catch (e) {
        logger.error("[FEEDBACK] Enable check job failed:", { error: e });
        throw e;
      }
    },
    { concurrency: 1 },
  );

  // Runs daily at 12:01 AM IST
  agenda.define(
    JOB_DISABLE,
    async (job) => {
      try {
        const settings = await FeedbackSettings.findOne();
        if (settings?.isEnabled && settings.currentWindowClosingTime) {
          if (new Date() > new Date(settings.currentWindowClosingTime)) {
            logger.info(`[FEEDBACK] Closing time reached, disabling now.`);
            await disableFeedbackAutomatic();
          }
        }
      } catch (e) {
        logger.error("[FEEDBACK] Disable check job failed:", { error: e });
        throw e;
      }
    },
    { concurrency: 1 },
  );

  // 12h reminder
  agenda.define(
    JOB_REMIND_12H,
    async (job) => {
      await sendFeedbackReminder(12);
    },
    { concurrency: 1 },
  );

  // 2h reminder
  agenda.define(
    JOB_REMIND_2H,
    async (job) => {
      await sendFeedbackReminder(2);
    },
    { concurrency: 1 },
  );
};

export const scheduleFeedbackJobs = () => {
  agenda.every("0 9 * * *", JOB_ENABLE, {}, { timezone: "Asia/Kolkata" });
  agenda.every("1 0 * * *", JOB_DISABLE, {}, { timezone: "Asia/Kolkata" });

  logger.info("[FEEDBACK] Scheduler initialized");

  // Restore reminders on boot if the window was already open before restart
  FeedbackSettings.findOne()
    .then(async (settings) => {
      if (settings?.isEnabled) {
        logger.info(
          "[FEEDBACK] Feedback window already open, restoring reminder jobs",
        );
        await scheduleFeedbackReminders();
      }
    })
    .catch((err) =>
      logger.error("[FEEDBACK] Boot-time reminder restore failed:", { error: err }),
    );
};
