const schedule = require("node-schedule");
const { User } = require("../user/userModel.js");
const UserAllocHostel = require("../hostel/hostelAllocModel.js");

/**
 * Core rotation logic
 */
const rotateMessAllotments = async () => {
  console.log("📅 [MESS ALLOTMENT] Starting monthly mess rotation...");
  try {
    // Find all users who have a staged next_mess
    const usersToRotate = await User.find({ next_mess: { $ne: null } });

    if (usersToRotate.length === 0) {
      console.log(
        "ℹ️ [MESS ALLOTMENT] No users found for rotation this month.",
      );
      return 0;
    }

    console.log(
      `🔄 [MESS ALLOTMENT] Rotating ${usersToRotate.length} users...`,
    );

    let count = 0;
    for (const user of usersToRotate) {
      const allottedMessId = user.next_mess;

      // 1. Update User model
      user.curr_subscribed_mess = allottedMessId;
      user.next_mess = null; // Clear staged mess
      await user.save();

      // 2. Update Hostel Allocation model to keep in sync
      if (user.rollNumber) {
        await UserAllocHostel.updateOne(
          { rollno: user.rollNumber },
          { $set: { current_subscribed_mess: allottedMessId } },
        );
      }
      count++;
    }

    console.log(
      `✅ [MESS ALLOTMENT] Monthly mess rotation completed successfully. (${count} users rotated)`,
    );
    return count;
  } catch (error) {
    console.error("❌ [MESS ALLOTMENT] Error during mess rotation:", error);
    throw error;
  }
};

/**
 * Initialize mess allotment scheduler
 * This scheduler runs at the beginning of the 1st of every month (00:00:00)
 * to move the 'next_mess' (allotted) to 'curr_subscribed_mess' (active).
 */
const initializeMessAllotmentScheduler = () => {
  console.log("🚀 Initializing mess allotment rotation scheduler...");

  schedule.scheduleJob("0 0 1 * *", async () => {
    await rotateMessAllotments();
  });

  console.log("✅ Mess allotment rotation scheduler initialized");
};

module.exports = {
  initializeMessAllotmentScheduler,
  rotateMessAllotments,
};
