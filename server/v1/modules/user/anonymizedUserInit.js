import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";
import { User } from "./userModel.js";

/**
 * Initialize anonymized user record for soft-deleted account references
 * This user is used to anonymize historical data (feedback, scan logs, etc.)
 * when accounts are deleted.
 */
export const initializeAnonymizedUser = async () => {
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
      logger.info("[ANONYMIZED USER] Created successfully");
    } else {
      logger.info("[ANONYMIZED USER] Already exists");
    }
  } catch (error) {
    logger.error("[ANONYMIZED USER] Error initializing:", { error: error });
    // Don't throw - allow server to continue even if this fails
  }
};
