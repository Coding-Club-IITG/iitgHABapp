const mongoose = require("mongoose");
const { User } = require("./userModel");

/**
 * Initialize anonymized user record for soft-deleted account references
 * This user is used to anonymize historical data (feedback, scan logs, etc.)
 * when accounts are deleted.
 */
const initializeAnonymizedUser = async () => {
  try {
    const ANONYMIZED_USER_ID = new mongoose.Types.ObjectId(
      "000000000000000000000000",
    );

    const anonymizedUser = await User.findById(ANONYMIZED_USER_ID);

    if (!anonymizedUser) {
      const user = new User({
        _id: ANONYMIZED_USER_ID,
        name: "Deleted User",
        rollNumber: "DELETED",
        email: null,
        authProvider: "microsoft",
        hasMicrosoftLinked: false,
      });

      await user.save();
      console.log("[ANONYMIZED USER] Created successfully");
    } else {
      console.log("[ANONYMIZED USER] Already exists");
    }
  } catch (error) {
    console.error("[ANONYMIZED USER] Error initializing:", error);
    // Don't throw - allow server to continue even if this fails
  }
};

module.exports = {
  initializeAnonymizedUser,
};
