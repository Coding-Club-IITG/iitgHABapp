import { logger } from "../../logging/logger.js";
import FestivalMode from "./festivalModeModel.js";
import agenda from "../../utils/agenda.js";
import { wipeFestivalVisibleContent } from "./festivalModeStateUtils.js";

const JOB_NAME = "festival-mode-auto-disable-daily";
export const runFestivalModeAutoDisableJob = async () => {
  const now = new Date();

  // Fast no-op path when festival mode is already disabled.
  const hasEnabledFestivalMode = await FestivalMode.exists({ isEnabled: true });
  if (!hasEnabledFestivalMode) {
    logger.info("[FESTIVAL MODE] Auto-disable skip: no enabled festival mode");
    return;
  }

  const expiredEnabledConfigs = await FestivalMode.find({
    isEnabled: true,
    expiresAt: { $ne: null, $lte: now },
  });

  for (const config of expiredEnabledConfigs) {
    wipeFestivalVisibleContent(config, now);
    await config.save();
  }

  if (expiredEnabledConfigs.length > 0) {
    logger.info(
      `[FESTIVAL MODE] Auto-disabled ${expiredEnabledConfigs.length} expired festival mode configuration(s) and wiped visible data`,
    );
  } else {
    logger.info(
      "[FESTIVAL MODE] Auto-disable check complete: no expired enabled config",
    );
  }
};

export const defineFestivalModeJobs = () => {
  agenda.define(
    JOB_NAME,
    async () => {
      try {
        logger.info("[FESTIVAL MODE] Daily auto-disable job fired");
        await runFestivalModeAutoDisableJob();
      } catch (err) {
        logger.error("[FESTIVAL MODE] Auto-disable job failed:", { error: err });
        throw err;
      }
    },
    { concurrency: 1 },
  );
};

// Every day at 03:10 AM IST
export const scheduleFestivalModeJobs = () => {
  agenda.every("10 3 * * *", JOB_NAME, {}, { timezone: "Asia/Kolkata" });
  logger.info("[FESTIVAL MODE] Scheduled: every day at 03:10 AM IST");
};
