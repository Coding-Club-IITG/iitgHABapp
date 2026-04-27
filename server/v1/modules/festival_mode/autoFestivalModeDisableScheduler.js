import FestivalMode from "./festivalModeModel.js";
import agenda from "../../utils/agenda.js";
import { wipeFestivalVisibleContent } from "./festivalModeStateUtils.js";

const JOB_NAME = "festival-mode-auto-disable-daily";
export const runFestivalModeAutoDisableJob = async () => {
  const now = new Date();

  // Fast no-op path when festival mode is already disabled.
  const hasEnabledFestivalMode = await FestivalMode.exists({ isEnabled: true });
  if (!hasEnabledFestivalMode) {
    console.log("[FESTIVAL MODE] Auto-disable skip: no enabled festival mode");
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
    console.log(
      `[FESTIVAL MODE] Auto-disabled ${expiredEnabledConfigs.length} expired festival mode configuration(s) and wiped visible data`,
    );
  } else {
    console.log(
      "[FESTIVAL MODE] Auto-disable check complete: no expired enabled config",
    );
  }
};

export const defineFestivalModeJobs = () => {
  agenda.define(
    JOB_NAME,
    async () => {
      try {
        console.log("[FESTIVAL MODE] Daily auto-disable job fired");
        await runFestivalModeAutoDisableJob();
      } catch (err) {
        console.error("[FESTIVAL MODE] Auto-disable job failed:", err);
        throw err;
      }
    },
    { concurrency: 1 },
  );
};

// Every day at 03:10 AM IST
export const scheduleFestivalModeJobs = () => {
  agenda.every("10 3 * * *", JOB_NAME, {}, { timezone: "Asia/Kolkata" });
  console.log("[FESTIVAL MODE] Scheduled: every day at 03:10 AM IST");
};
