import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";

import { User } from "../user/userModel.js";
import FCMToken from "../notification/FCMToken.js";
import { MenuItem } from "../mess/menuItemModel.js";
import Feedback from "../feedback/feedbackModel.js";
import { ScanLogs } from "../mess/ScanLogsModel.js";

import { withTransaction } from "../../utils/withTransaction.js";
import redisClient from "../../utils/redisClient.js";
import agenda from "../../utils/agenda.js";

const JOB_NAME = "guest-cleanup-weekly";
const ANONYMIZED_USER_ID = new mongoose.Types.ObjectId(
  "000000000000000000000000",
);

// Cleanup old unlinked guest accounts
// Deletes guest accounts that:
// 1. Have guestIdentifier (are guest accounts)
// 2. Don't have Microsoft linked (hasMicrosoftLinked === false)
// 3. Are older than 7 days
const cleanupOldGuestAccounts = async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const cutoffObjectId = mongoose.Types.ObjectId.createFromTime(
    Math.floor(cutoffDate.getTime() / 1000),
  );

  const oldGuestAccounts = await User.find({
    guestIdentifier: { $exists: true, $ne: null },
    hasMicrosoftLinked: false,
    _id: { $lt: cutoffObjectId },
  });

  if (oldGuestAccounts.length === 0) {
    logger.info("[GUEST CLEANUP] No old guest accounts to clean up");
    return;
  }

  logger.info(
    `[GUEST CLEANUP] Found ${oldGuestAccounts.length} old unlinked guest accounts`,
  );

  const userIds = oldGuestAccounts.map((u) => u._id);

  // ATOMIC TRANSACTION
  await withTransaction(async (session) => {
    // 1. Delete FCM tokens
    await FCMToken.deleteMany({ user: { $in: userIds } }, { session });

    // 2. Remove from menu item likes
    await MenuItem.updateMany(
      { likes: { $in: userIds } },
      { $pull: { likes: { $in: userIds } } },
      { session },
    );

    // 3. Anonymize feedback
    await Feedback.updateMany(
      { user: { $in: userIds } },
      { $set: { user: ANONYMIZED_USER_ID } },
      { session },
    );

    // 4. Anonymize scan logs
    await ScanLogs.updateMany(
      { userId: { $in: userIds } },
      { $set: { userId: ANONYMIZED_USER_ID } },
      { session },
    );

    // 5. Delete the user documents themselves
    await User.deleteMany({ _id: { $in: userIds } }, { session });
  });

  // Redis cache invalidation
  try {
    await redisClient.del("all_users");
    await redisClient.del("user_count");
  } catch (redisErr) {
    logger.error("[GUEST CLEANUP] Redis cache clear failed:", { error: redisErr });
  }

  logger.info("Old guest accounts deleted");
};

export const defineGuestCleanupJobs = () => {
  agenda.define(
    JOB_NAME,
    async (job) => {
      try {
        logger.info("[GUEST CLEANUP] Weekly job fired");
        await cleanupOldGuestAccounts();
      } catch (err) {
        logger.error("[GUEST CLEANUP] Job failed:", { error: err });
        throw err;
      }
    },
    { concurrency: 1 },
  );
};

// Every Monday at 02:00 AM IST
export const scheduleGuestCleanupJobs = () => {
  agenda.every("0 2 * * 1", JOB_NAME, {}, { timezone: "Asia/Kolkata" });
  logger.info("[GUEST CLEANUP] Scheduled: every Monday at 02:00 AM IST");
};
