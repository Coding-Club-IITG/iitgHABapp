const schedule = require("node-schedule");
const mongoose = require("mongoose");
const { User } = require("../user/userModel");
const FCMToken = require("../notification/FCMToken.js");
const Notification = require("../notification/notificationModel.js");
const { MenuItem } = require("../mess/menuItemModel.js");
const Feedback = require("../feedback/feedbackModel.js");
const { ScanLogs } = require("../mess/ScanLogsModel.js");
const redisClient = require("../../utils/redisClient.js");

// Cleanup old unlinked guest accounts
// Deletes guest accounts that:
// 1. Have guestIdentifier (are guest accounts)
// 2. Don't have Microsoft linked (hasMicrosoftLinked === false)
// 3. Are older than 7 days
const cleanupOldGuestAccounts = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago

    const cutoffObjectId = mongoose.Types.ObjectId.createFromTime(
      Math.floor(cutoffDate.getTime() / 1000),
    );

    // Find old unlinked guest accounts
    const oldGuestAccounts = await User.find({
      guestIdentifier: { $exists: true, $ne: null },
      hasMicrosoftLinked: false,
      _id: { $lt: cutoffObjectId },
    });

    if (oldGuestAccounts.length === 0) {
      console.log("🧹 No old guest accounts to clean up");
      return;
    }

    console.log(
      `🧹 Found ${oldGuestAccounts.length} old unlinked guest accounts to delete`,
    );

    const userIds = oldGuestAccounts.map((user) => user._id);
    const ANONYMIZED_USER_ID = new mongoose.Types.ObjectId(
      "000000000000000000000000",
    );

    try {
      // 1. Delete FCM Tokens
      await FCMToken.deleteMany({ user: { $in: userIds } });

      // 2. Notifications
      // Remove from recipients
      await Notification.updateMany(
        { recipients: { $in: userIds } },
        { $pullAll: { recipients: userIds } },
      );

      // Remove from readBy
      await Notification.updateMany(
        { readBy: { $in: userIds } },
        { $pullAll: { readBy: userIds } },
      );

      // 3. Remove from Menu Item Likes array
      await MenuItem.updateMany(
        { likes: { $in: userIds } },
        { $pullAll: { likes: userIds } },
      );

      // 4. Anonymize Feedback
      await Feedback.updateMany(
        { user: { $in: userIds } },
        { $set: { user: ANONYMIZED_USER_ID } },
      );

      // 5. Anonymize Scan Logs
      await ScanLogs.updateMany(
        { userId: { $in: userIds } },
        { $set: { userId: ANONYMIZED_USER_ID } },
      );

      // 6. Finally delete the users
      const result = await User.deleteMany({ _id: { $in: userIds } });

      // Clear cache
      try {
        await redisClient.del("all_users");
        await redisClient.del("user_count");
      } catch (redisErr) {
        console.error("❌ Error clearing redis cache:", redisErr);
      }

      console.log(
        `✅ Deleted ${result.deletedCount} old guest accounts (older than 7 days and unlinked)`,
      );
    } catch (error) {
      throw error;
    }
  } catch (err) {
    console.error("❌ Error cleaning up old guest accounts:", err);
  }
};

// Initialize guest cleanup scheduler
const initializeGuestCleanupScheduler = () => {
  console.log("🚀 Initializing automatic guest cleanup scheduler...");

  // Schedule cleanup - runs every Monday at 2 AM IST
  schedule.scheduleJob("0 2 * * 1", async () => {
    console.log("🧹 Running scheduled guest account cleanup (Monday 2 AM)...");
    await cleanupOldGuestAccounts();
  });

  console.log("✅ Automatic guest cleanup scheduler initialized");
};

module.exports = {
  initializeGuestCleanupScheduler,
  cleanupOldGuestAccounts,
};
