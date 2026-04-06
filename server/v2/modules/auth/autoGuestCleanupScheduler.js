const schedule = require("node-schedule");
const { User } = require("../user/userModel");

// Cleanup old unlinked guest accounts
// Deletes guest accounts that:
// 1. Have guestIdentifier (are guest accounts)
// 2. Don't have Microsoft linked (hasMicrosoftLinked === false)
// 3. Are older than 7 days
const cleanupOldGuestAccounts = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago

    // Find old unlinked guest accounts
    const oldGuestAccounts = await User.find({
      guestIdentifier: { $exists: true, $ne: null },
      hasMicrosoftLinked: false,
      createdAt: { $lt: cutoffDate },
    });

    if (oldGuestAccounts.length === 0) {
      console.log("🧹 No old guest accounts to clean up");
      return;
    }

    console.log(
      `🧹 Found ${oldGuestAccounts.length} old unlinked guest accounts to delete`
    );

    // Delete them
    const result = await User.deleteMany({
      guestIdentifier: { $exists: true, $ne: null },
      hasMicrosoftLinked: false,
      createdAt: { $lt: cutoffDate },
    });

    console.log(
      `✅ Deleted ${result.deletedCount} old guest accounts (older than 7 days and unlinked)`
    );
  } catch (err) {
    console.error("❌ Error cleaning up old guest accounts:", err);
  }
};

// Initialize guest cleanup scheduler
const initializeGuestCleanupScheduler = () => {
  console.log("🚀 Initializing automatic guest cleanup scheduler...");

  // Schedule cleanup - runs every Monday at 2 AM IST
  // Cron format: "minute hour day month dayOfWeek"
  // dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, etc.
  schedule.scheduleJob("0 2 * * 1", async () => {
    console.log("🧹 Running scheduled guest account cleanup (Monday 2 AM)...");
    await cleanupOldGuestAccounts();
  });

  console.log("✅ Automatic guest cleanup scheduler initialized");
  console.log("📅 Guest cleanup scheduled: Every Monday at 2:00 AM IST");
};

module.exports = {
  initializeGuestCleanupScheduler,
  cleanupOldGuestAccounts,
};

