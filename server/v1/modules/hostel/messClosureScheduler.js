const schedule = require("node-schedule");
const { MessClosure } = require("./messClosureModel.js");
const { Hostel } = require("./hostelModel.js");
const { sendNotificationMessage } = require("../notification/notificationController.js");

// Map to store scheduled jobs for later cancellation
const scheduledJobs = new Map();

/**
 * Helper: Convert UTC Date to IST timezone string for display
 * @param {Date} utcDate - Date in UTC
 * @returns {string} - Formatted date string in IST
 */
const formatDateToIST = (utcDate) => {
  try {
    return new Date(utcDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch (error) {
    console.error("Error formatting date to IST:", error);
    return utcDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
};

/**
 * Helper: Format time in IST for logging
 * @param {Date} utcDate - Date in UTC
 * @returns {string} - formatted time string in IST
 */
const formatTimeToIST = (utcDate) => {
  try {
    return new Date(utcDate).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  } catch (error) {
    console.error("Error formatting time to IST:", error);
    return utcDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
};

/**
 * Calculate reminder time: 1 day before closure at 9:00 AM IST
 * @param {Date} closureDate - The date when mess will be closed (UTC)
 * @returns {Date} - The reminder date/time in UTC
 */
const calculateReminderTime = (closureDate) => {
  // Create a date 1 day before closure
  const reminderDate = new Date(closureDate);
  reminderDate.setDate(reminderDate.getDate() - 1);

  // Set time to 9:00 AM IST
  // IST is UTC+5:30, so we need to set the time in UTC to achieve 9:00 AM IST
  reminderDate.setUTCHours(3, 30, 0, 0); // 3:30 UTC = 9:00 AM IST

  return reminderDate;
};

/**
 * Generate a unique job name for this closure reminder
 * @param {string} closureId - The ObjectId of the closure
 * @returns {string} - Job name pattern
 */
const getJobName = (closureId) => {
  return `messclosure-reminder-${closureId}`;
};

/**
 * Schedule a 1-day-before reminder notification for a mess closure
 * @param {Object} closure - The MessClosure document
 */
const scheduleReminderNotification = async (closure) => {
  const closureId = closure._id.toString();
  const jobName = getJobName(closureId);
  
  try {
    // Calculate reminder time
    const reminderTime = calculateReminderTime(closure.closureDate);
    const now = new Date();

    // Check if reminder time is in the future
    if (reminderTime <= now) {
      console.warn(
        `[MessClosure Scheduler] Reminder time (${formatTimeToIST(reminderTime)} IST) for closure ${closureId} is in the past, skipping schedule`
      );
      return;
    }

    // Get hostel name for notification topic
    const hostel = await Hostel.findById(closure.hostelId);
    if (!hostel) {
      console.error(
        `[MessClosure Scheduler] Hostel ${closure.hostelId} not found when scheduling reminder for closure ${closureId}`
      );
      return;
    }

    const hostelName = hostel.hostel_name;
    const notificationTopic = `Subscribers_${hostelName}`;
    const formattedClosureDate = formatDateToIST(closure.closureDate);

    // Schedule the job
    const job = schedule.scheduleJob(jobName, reminderTime, async () => {
      try {
        console.log(
          `[MessClosure Scheduler] Executing reminder notification for closure ${closureId} (${formattedClosureDate})`
        );

        // Send reminder notification
        try {
          await sendNotificationMessage(
            "Mess Closure Reminder",
            `Reminder: Mess will be closed tomorrow (${formattedClosureDate})`,
            notificationTopic,
            { closureId: closureId, hostelId: closure.hostelId.toString() },
            false
          );
          console.log(
            `[MessClosure Scheduler] Reminder notification sent for closure ${closureId}`
          );
        } catch (notifError) {
          console.error(
            `[MessClosure Scheduler] Notification send failed for closure ${closureId}:`,
            notifError.message
          );
          // Don't fail the job execution, just log the notification error
        }

        // Update the closure record to mark reminder as sent
        try {
          await MessClosure.findByIdAndUpdate(closureId, {
            reminderScheduled: true,
            updatedAt: new Date(),
          });
        } catch (dbError) {
          console.error(
            `[MessClosure Scheduler] Database update failed for closure ${closureId}:`,
            dbError.message
          );
        }

        // Remove from scheduled jobs map
        scheduledJobs.delete(jobName);
      } catch (error) {
        console.error(
          `[MessClosure Scheduler] Unexpected error executing reminder notification for closure ${closureId}:`,
          error.message
        );
        // Remove from scheduled jobs map even if there's an error
        scheduledJobs.delete(jobName);
      }
    });

    if (!job) {
      console.error(`[MessClosure Scheduler] Failed to create job ${jobName}`);
      return;
    }

    // Store job reference for later cancellation
    scheduledJobs.set(jobName, job);

    console.log(
      `[MessClosure Scheduler] Scheduled reminder notification for closure ${closureId} at ${formatTimeToIST(reminderTime)} IST (${formatDateToIST(closure.closureDate)})`
    );
  } catch (error) {
    console.error(
      `[MessClosure Scheduler] Error scheduling reminder notification for closure ${closureId}:`,
      error.message
    );
    // Don't throw - let the caller handle missing reminders gracefully
  }
};

/**
 * Cancel a scheduled reminder notification
 * @param {string} closureId - The ObjectId of the closure
 */
const cancelReminderNotification = async (closureId) => {
  const closureIdStr = closureId.toString();
  const jobName = getJobName(closureIdStr);

  try {
    // Find and cancel the job
    const job = scheduledJobs.get(jobName);

    if (job) {
      job.cancel();
      scheduledJobs.delete(jobName);
      console.log(
        `[MessClosure Scheduler] Cancelled reminder notification for closure ${closureIdStr}`
      );
    } else {
      console.log(
        `[MessClosure Scheduler] No scheduled job found for closure ${closureIdStr} (may have already executed)`
      );
    }

    // Update the closure record to mark reminder as not scheduled
    try {
      await MessClosure.findByIdAndUpdate(closureIdStr, {
        reminderScheduled: false,
        updatedAt: new Date(),
      });
    } catch (dbError) {
      console.error(
        `[MessClosure Scheduler] Database update failed when canceling reminder for closure ${closureIdStr}:`,
        dbError.message
      );
    }
  } catch (error) {
    console.error(
      `[MessClosure Scheduler] Error canceling reminder notification for closure ${closureIdStr}:`,
      error.message
    );
    // Don't throw - allow cancellation failures to be non-blocking
  }
};

/**
 * Clean up all scheduled reminder jobs
 * Called on server shutdown
 */
const cleanupAllScheduledJobs = () => {
  try {
    let canceledCount = 0;
    scheduledJobs.forEach((job, jobName) => {
      try {
        job.cancel();
        canceledCount++;
      } catch (error) {
        console.error(
          `[MessClosure Scheduler] Error canceling job ${jobName}:`,
          error.message
        );
      }
    });
    scheduledJobs.clear();
    console.log(
      `[MessClosure Scheduler] All ${canceledCount} scheduled closure reminder jobs have been cleaned up`
    );
  } catch (error) {
    console.error(
      "[MessClosure Scheduler] Error cleaning up scheduled jobs:",
      error.message
    );
  }
};

/**
 * Initialize scheduled reminders from database
 * Called on server startup to restore any pending reminders
 */
const initializeScheduledReminders = async () => {
  try {
    console.log(
      "[MessClosure Scheduler] Initializing scheduled reminders for mess closures..."
    );

    // Find all closures where reminder needs to be scheduled
    const closures = await MessClosure.find({
      closureDate: { $gte: new Date() },
      reminderScheduled: false,
    }).catch((error) => {
      console.error(
        "[MessClosure Scheduler] Database query failed during initialization:",
        error.message
      );
      return [];
    });

    console.log(
      `[MessClosure Scheduler] Found ${closures.length} closures needing reminder scheduling`
    );

    let successCount = 0;
    let failureCount = 0;

    for (const closure of closures) {
      try {
        await scheduleReminderNotification(closure);
        successCount++;
      } catch (error) {
        console.error(
          `[MessClosure Scheduler] Failed to schedule reminder for closure ${closure._id}:`,
          error.message
        );
        failureCount++;
      }
    }

    console.log(
      `[MessClosure Scheduler] Scheduled reminders initialization complete (${successCount} success, ${failureCount} failed)`
    );
  } catch (error) {
    console.error(
      "[MessClosure Scheduler] Error initializing scheduled reminders:",
      error.message
    );
  }
};

module.exports = {
  scheduleReminderNotification,
  cancelReminderNotification,
  cleanupAllScheduledJobs,
  initializeScheduledReminders,
  calculateReminderTime,
  formatDateToIST,
  formatTimeToIST,
};
