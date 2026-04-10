const { User } = require("../user/userModel.js");
const UserAllocHostel = require("../hostel/hostelAllocModel.js");
const { MessChangeSettings } = require("./messChangeSettingsModel");
const { withTransaction } = require("../../utils/withTransaction.js");
const agenda = require("../../utils/agenda.js");

const JOB_NAME = "mess-allotment-rotate";

/**
 * Core rotation logic
 */
const rotateMessAllotments = async () => {
  console.log("[MESS ALLOTMENT] Starting monthly mess rotation...");

  // Safety check: ensure mess change processing has occurred
  const settings = await MessChangeSettings.findOne();
  const now = new Date();

  if (
    settings?.currentWindowClosingTime &&
    now > settings.currentWindowClosingTime
  ) {
    const closingTime = new Date(settings.currentWindowClosingTime);
    const lastProcessed = settings.lastProcessedAt
      ? new Date(settings.lastProcessedAt)
      : null;

    if (!lastProcessed || lastProcessed < closingTime) {
      console.error(
        `[MESS ALLOTMENT] CRITICAL: Rotation aborted! ` +
          `Processing for the window closing at ${closingTime.toLocaleString()} has not occurred. ` +
          `Last processed at: ${lastProcessed ? lastProcessed.toLocaleString() : "Never"}`,
      );
      return 0;
    }
  }

  // Find all users who have a staged next_mess
  const allocations = await UserAllocHostel.find({}).lean();
  const usersToRotate = await User.find({ next_mess: { $ne: null } }).lean();

  if (usersToRotate.length === 0) {
    console.log("[MESS ALLOTMENT] No users to rotate this month.");
    return 0;
  }

  console.log(`[MESS ALLOTMENT] Rotating ${usersToRotate.length} users...`);

  // Build all bulk-write operations in memory
  const allocBulkOps = [];
  const userBulkOps = [];

  // 1. Reset everyone back to their boarding hostel
  for (const alloc of allocations) {
    allocBulkOps.push({
      updateOne: {
        filter: { _id: alloc._id },
        update: { $set: { current_subscribed_mess: alloc.hostel } },
      },
    });
    userBulkOps.push({
      updateOne: {
        filter: { rollNumber: alloc.rollno },
        update: {
          $set: { curr_subscribed_mess: alloc.hostel, got_mess_changed: false },
        },
      },
    });
  }

  // 2. Apply the staged next_mess for each approved user
  for (const user of usersToRotate) {
    userBulkOps.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            curr_subscribed_mess: user.next_mess,
            got_mess_changed: true,
            next_mess: null,
          },
        },
      },
    });
    if (user.rollNumber) {
      allocBulkOps.push({
        updateOne: {
          filter: { rollno: user.rollNumber },
          update: { $set: { current_subscribed_mess: user.next_mess } },
        },
      });
    }
  }

  // ATOMIC TRANSACTION
  await withTransaction(async (session) => {
    if (allocBulkOps.length > 0) {
      await UserAllocHostel.bulkWrite(allocBulkOps, { session });
    }
    if (userBulkOps.length > 0) {
      await User.bulkWrite(userBulkOps, { session });
    }
  });

  console.log(
    `[MESS ALLOTMENT] Rotation complete. ${usersToRotate.length} users rotated.`,
  );
  return usersToRotate.length;
};

/**
 * Initialize mess allotment scheduler
 * This scheduler runs at the beginning of the 1st of every month
 * to move the 'next_mess' (allotted) to 'curr_subscribed_mess' (active).
 */
const initializeMessAllotmentScheduler = () => {
  agenda.define(JOB_NAME, async (job) => {
    try {
      console.log("[MESS ALLOTMENT] Agenda job fired");
      await rotateMessAllotments();
    } catch (err) {
      console.error("[MESS ALLOTMENT] Job failed:", err);
      throw err; // Rethrow so Agenda marks the job as failed and records the error
    }
  }, { priority: "high", concurrency: 1 });

  // Schedule: 1st of every month at 00:05 IST
  agenda.every("5 0 1 * *", JOB_NAME, {}, { timezone: "Asia/Kolkata" });
  console.log("[MESS ALLOTMENT] Scheduled: 1st of every month at 00:05 IST");
};

module.exports = {
  initializeMessAllotmentScheduler,
  rotateMessAllotments,
};
