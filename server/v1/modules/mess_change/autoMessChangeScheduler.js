import { MessChangeSettings } from "./messChangeSettingsModel.js";
import { User } from "../user/userModel.js";

import {
  enableMessChangeAutomatic,
  disableMessChangeAutomatic,
} from "./controllers/schedulerController.js";
import { sendNotificationToMultipleUsers } from "../notification/notificationController.js";

import { getMessChangeWindowDates } from "../../utils/windowDates.js";
import agenda from "../../utils/agenda.js";

const JOB_ENABLE = "messchange-enable-check";
const JOB_DISABLE = "messchange-disable-check";
const JOB_REMIND_12H = "messchange-reminder-12h";
const JOB_REMIND_2H = "messchange-reminder-2h";

/**
 * Sends a targeted reminder only to students who haven't applied for a mess change
 * @param {number} hoursLeft - The number of hours remaining in the window
 */
const sendMessChangeReminder = async (hoursLeft) => {
  try {
    // Find all users who have NOT applied for a mess change this month
    const slackers = await User.find({
      applied_for_mess_changed: false,
    }).select("_id");

    if (slackers.length === 0) {
      console.log(`[MESS CHANGE] No reminders needed for ${hoursLeft}hr mark`);
      return;
    }

    const userIds = slackers.map((u) => u._id);

    const response = await sendNotificationToMultipleUsers(
      userIds,
      "Mess Change Window Closing! ⏳",
      `You have ${hoursLeft} hours left to apply for a mess change for next month.`,
      "hab_mess_updates",
    );

    console.log(
      `[MESS CHANGE] Sent ${hoursLeft}hr reminder to ${response.successCount} users`,
    );
  } catch (error) {
    console.error("[MESS CHANGE] Error sending reminders:", error);
  }
};

// Schedule reminder notifications
const scheduleMessChangeReminders = async () => {
  try {
    const settings = await MessChangeSettings.findOne();
    if (!settings?.isEnabled || !settings.enabledAt) return;

    // Get closing time
    const { endDate } = getMessChangeWindowDates();
    const closingTime = endDate;
    const now = new Date();

    // Cancel any previously scheduled reminder jobs
    await agenda.cancel({ name: { $in: [JOB_REMIND_12H, JOB_REMIND_2H] } });

    // 12 hours before closing
    const reminder12h = new Date(closingTime.getTime() - 12 * 60 * 60 * 1000);
    if (reminder12h > now) {
      await agenda.schedule(reminder12h, JOB_REMIND_12H);
      console.log(
        `[MESS CHANGE] Scheduled 12h reminder for ${reminder12h.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
    }

    // 2 hours before closing
    const reminder2h = new Date(closingTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      await agenda.schedule(reminder2h, JOB_REMIND_2H);
      console.log(
        `[MESS CHANGE] Scheduled 2h reminder for ${reminder2h.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
    }
  } catch (error) {
    console.error("[MESS CHANGE] Error scheduling reminders:", error);
  }
};

// Initialize mess change scheduler
export const initializeMessChangeAutoScheduler = () => {
  // Runs daily at 9 AM IST
  agenda.define(
    JOB_ENABLE,
    async (job) => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();

        const { startDate, endDate } = getMessChangeWindowDates(month, year);

        if (day === startDate.getDate()) {
          console.log(
            `[MESS CHANGE] Start date detected: ${day}/${month + 1}/${year}`,
          );
          await enableMessChangeAutomatic(endDate);
          await scheduleMessChangeReminders();
        }
      } catch (e) {
        console.error("[MESS CHANGE] Enable check job failed:", e);
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
        const settings = await MessChangeSettings.findOne();
        if (settings?.isEnabled && settings.currentWindowClosingTime) {
          if (new Date() > new Date(settings.currentWindowClosingTime)) {
            console.log(`[MESS CHANGE] Closing time reached, disabling now.`);
            await disableMessChangeAutomatic();
          }
        }
      } catch (e) {
        console.error("[MESS CHANGE] Disable check job failed:", e);
        throw e;
      }
    },
    { concurrency: 1 },
  );

  // 12h reminder
  agenda.define(
    JOB_REMIND_12H,
    async (job) => {
      await sendMessChangeReminder(12);
    },
    { concurrency: 1 },
  );

  // 2h reminder
  agenda.define(
    JOB_REMIND_2H,
    async (job) => {
      await sendMessChangeReminder(2);
    },
    { concurrency: 1 },
  );

  // Set up recurring schedules
  agenda.every("0 9 * * *", JOB_ENABLE, {}, { timezone: "Asia/Kolkata" });
  agenda.every("1 0 * * *", JOB_DISABLE, {}, { timezone: "Asia/Kolkata" });

  console.log("[MESS CHANGE] Scheduler initialized");

  // Restore reminders on boot if the window was already open before restart
  MessChangeSettings.findOne()
    .then(async (settings) => {
      if (settings?.isEnabled) {
        console.log(
          "[MESS CHANGE] Mess change window already open, restoring reminder jobs",
        );
        await scheduleMessChangeReminders();
      }
    })
    .catch((err) =>
      console.error("[MESS CHANGE] Boot-time reminder restore failed:", err),
    );
};
