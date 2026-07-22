import agenda from "../../utils/agenda.js";
import {
  SummerMessAutomationLockedError,
  withSummerMessAutomationLock,
} from "./summerMessAutomationLock.js";

import {
  activateSummerSeason,
  closeSummerRegistrationForSeason,
  getActiveSummerMessSettings,
  getOpenSummerRegistrationSettings,
  getSummerMessSettingsList,
  isSummerActive,
  isSummerRegistrationOpen,
  openSummerRegistrationForSeason,
  restoreSummerSeason,
} from "./summerMessService.js";

const JOB_NAME = "summermess-transition-check";

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSeasonName(settings) {
  return settings?.seasonLabel || settings?.seasonKey || "summer mess season";
}

function hasSeasonEnded(settings, now = new Date()) {
  const summerEndAt = toDateOrNull(settings?.summerEndAt);
  return Boolean(summerEndAt && summerEndAt < now);
}

function isRegistrationDueToOpen(settings, now = new Date()) {
  const registrationStartAt = toDateOrNull(settings?.registrationStartAt);
  const registrationEndAt = toDateOrNull(settings?.registrationEndAt);

  if (!registrationStartAt || registrationStartAt > now) return false;
  if (registrationEndAt && now > registrationEndAt) return false;

  return true;
}

function isSummerDueToActivate(settings, now = new Date()) {
  const summerStartAt = toDateOrNull(settings?.summerStartAt);
  const summerEndAt = toDateOrNull(settings?.summerEndAt);

  if (!summerStartAt || summerStartAt > now) return false;
  if (summerEndAt && now > summerEndAt) return false;
  if (isSummerActive(settings)) return false;

  return true;
}

function compareByDate(a, b, selector) {
  const aTime = selector(a)?.getTime() ?? 0;
  const bTime = selector(b)?.getTime() ?? 0;
  if (aTime !== bTime) return aTime - bTime;

  return String(a?._id || "").localeCompare(String(b?._id || ""));
}

export async function runSummerMessAutomationCycle(now = new Date()) {
  return withSummerMessAutomationLock(async () => {
    const summary = {
      closedRegistration: [],
      restoredSeasons: [],
      openedRegistration: null,
      activatedSeason: null,
    };

    const settingsList = await getSummerMessSettingsList();

    const staleOpenRegistrations = settingsList
      .filter(
        (settings) =>
          settings.isRegistrationOpen &&
          !isSummerRegistrationOpen(settings, now),
      )
      .sort((a, b) =>
        compareByDate(a, b, (settings) =>
          toDateOrNull(settings.registrationEndAt),
        ),
      );

    for (const settings of staleOpenRegistrations) {
      await closeSummerRegistrationForSeason({ seasonId: settings._id });
      summary.closedRegistration.push(settings.seasonKey);
      console.log(
        `[SUMMER MESS] Auto-closed registration for ${formatSeasonName(settings)}`,
      );
    }

    const expiredActiveSeasons = settingsList
      .filter(
        (settings) => isSummerActive(settings) && hasSeasonEnded(settings, now),
      )
      .sort((a, b) =>
        compareByDate(a, b, (settings) => toDateOrNull(settings.summerEndAt)),
      );

    for (const settings of expiredActiveSeasons) {
      const { restoredCount } = await restoreSummerSeason({
        seasonId: settings._id,
        restoredAt: now,
      });
      summary.restoredSeasons.push({
        seasonKey: settings.seasonKey,
        restoredCount,
      });
      console.log(
        `[SUMMER MESS] Auto-restored ${formatSeasonName(settings)} with ${restoredCount} default subscription(s)`,
      );
    }

    const openRegistrationSeason = await getOpenSummerRegistrationSettings({
      now,
    });
    if (!openRegistrationSeason) {
      const refreshedSettingsList = await getSummerMessSettingsList();
      const nextRegistrationSeason = refreshedSettingsList
        .filter(
          (settings) =>
            !settings.isRegistrationOpen &&
            isRegistrationDueToOpen(settings, now) &&
            !hasSeasonEnded(settings, now),
        )
        .sort((a, b) =>
          compareByDate(a, b, (settings) =>
            toDateOrNull(settings.registrationStartAt),
          ),
        )[0];

      if (nextRegistrationSeason) {
        await openSummerRegistrationForSeason({
          seasonId: nextRegistrationSeason._id,
          now,
        });
        summary.openedRegistration = nextRegistrationSeason.seasonKey;
        console.log(
          `[SUMMER MESS] Auto-opened registration for ${formatSeasonName(nextRegistrationSeason)}`,
        );
      }
    }

    const activeSeason = await getActiveSummerMessSettings();
    if (!activeSeason) {
      const refreshedSettingsList = await getSummerMessSettingsList();
      const nextSeasonToActivate = refreshedSettingsList
        .filter((settings) => isSummerDueToActivate(settings, now))
        .sort((a, b) =>
          compareByDate(a, b, (settings) =>
            toDateOrNull(settings.summerStartAt),
          ),
        )[0];

      if (nextSeasonToActivate) {
        const { activatedCount } = await activateSummerSeason({
          seasonId: nextSeasonToActivate._id,
          activatedAt: now,
        });
        summary.activatedSeason = {
          seasonKey: nextSeasonToActivate.seasonKey,
          activatedCount,
        };
        console.log(
          `[SUMMER MESS] Auto-activated ${formatSeasonName(nextSeasonToActivate)} with ${activatedCount} acknowledged application(s)`,
        );
      }
    }

    return summary;
  });
}

export const defineSummerMessJobs = () => {
  agenda.define(
    JOB_NAME,
    async () => {
      try {
        await runSummerMessAutomationCycle();
      } catch (error) {
        if (error instanceof SummerMessAutomationLockedError) {
          console.log(
            "[SUMMER MESS] Transition cycle skipped because another transition is already running",
          );
          return;
        }
        console.error("[SUMMER MESS] Automation cycle failed:", error);
        throw error;
      }
    },
    { concurrency: 1 },
  );
};

export const scheduleSummerMessJobs = () => {
  agenda.every("*/5 * * * *", JOB_NAME, {}, { timezone: "Asia/Kolkata" });
  console.log("[SUMMER MESS] Scheduler initialized: every 5 minutes");
};
