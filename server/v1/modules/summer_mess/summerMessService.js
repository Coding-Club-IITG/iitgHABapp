import redisClient from "../../utils/redisClient.js";
import { clearCacheByPattern } from "../../utils/redisUtils.js";
import { withTransaction } from "../../utils/withTransaction.js";

import UserAllocHostel from "../hostel/hostelAllocModel.js";
import { User } from "../user/userModel.js";

import { SummerMessApplication } from "./summerMessApplicationModel.js";
import { SummerMessSettings } from "./summerMessSettingsModel.js";

export function defaultSeasonKey(now = new Date()) {
  return `summer-${now.getFullYear()}`;
}

export function defaultSeasonLabel(now = new Date()) {
  return `Summer ${now.getFullYear()}`;
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function inclusiveSummerDays(startAt, endAt) {
  const start = toDateOrNull(startAt);
  const end = toDateOrNull(endAt);
  if (!start || !end || end < start) return 0;

  const startMidnight = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endMidnight = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );
  return Math.floor((endMidnight - startMidnight) / (24 * 60 * 60 * 1000)) + 1;
}

export function buildSummerMessPricing(settings) {
  const totalDays = inclusiveSummerDays(
    settings?.summerStartAt,
    settings?.summerEndAt,
  );
  const ratePerDay = Number(settings?.ratePerDay) || 0;
  return {
    ratePerDay,
    totalDays,
    totalAmount: totalDays * ratePerDay,
  };
}

function sortTimestamp(settings) {
  return (
    toDateOrNull(settings?.summerStartAt)?.getTime() ??
    toDateOrNull(settings?.registrationStartAt)?.getTime() ??
    toDateOrNull(settings?.registrationEndAt)?.getTime() ??
    toDateOrNull(settings?.activatedAt)?.getTime() ??
    toDateOrNull(settings?.createdAt)?.getTime() ??
    0
  );
}

function compareSeasonSettings(a, b) {
  const timestampDiff = sortTimestamp(a) - sortTimestamp(b);
  if (timestampDiff !== 0) return timestampDiff;

  return String(a?._id || "").localeCompare(String(b?._id || ""));
}

function pickLatestSeason(settingsList = []) {
  return (
    [...settingsList].sort((a, b) => compareSeasonSettings(b, a))[0] || null
  );
}

export function isSummerRegistrationOpen(settings, now = new Date()) {
  if (!settings?.isRegistrationOpen) return false;
  const registrationStartAt = toDateOrNull(settings.registrationStartAt);
  const registrationEndAt = toDateOrNull(settings.registrationEndAt);

  if (registrationStartAt && now < registrationStartAt) {
    return false;
  }
  if (registrationEndAt && now > registrationEndAt) {
    return false;
  }

  return true;
}

export function isSummerActive(settings) {
  return settings?.isSummerActive === true;
}

function hasSeasonEnded(settings, now = new Date()) {
  const summerEndAt = toDateOrNull(settings?.summerEndAt);
  return Boolean(summerEndAt && summerEndAt < now);
}

function isFutureOrPendingSeason(settings, now = new Date()) {
  if (!settings) return false;
  if (isSummerRegistrationOpen(settings, now)) return true;
  if (isSummerActive(settings)) return false;
  if (hasSeasonEnded(settings, now)) return false;

  const registrationStartAt = toDateOrNull(settings.registrationStartAt);
  const registrationEndAt = toDateOrNull(settings.registrationEndAt);
  const summerStartAt = toDateOrNull(settings.summerStartAt);
  const summerEndAt = toDateOrNull(settings.summerEndAt);

  if (summerStartAt && summerStartAt >= now) return true;
  if (registrationEndAt && registrationEndAt >= now) return true;
  if (registrationStartAt && registrationStartAt >= now) return true;
  if (summerEndAt && summerEndAt >= now) return true;

  return false;
}

function isSummerWindowClashing({
  summerStartAt,
  summerEndAt,
  otherSummerStartAt,
  otherSummerEndAt,
}) {
  const start = toDateOrNull(summerStartAt);
  const end = toDateOrNull(summerEndAt);
  const otherStart = toDateOrNull(otherSummerStartAt);
  const otherEnd = toDateOrNull(otherSummerEndAt);

  if (!start || !end || !otherStart || !otherEnd) return false;
  return start <= otherEnd && otherStart <= end;
}

function serializeApplication(application) {
  if (!application) return null;

  return {
    _id: application._id,
    status: application.status,
    appliedAt: application.createdAt,
    updatedAt: application.updatedAt,
    acknowledgedAt: application.acknowledgedAt || null,
    messChangedAt: application.messChangedAt || null,
    ratePerDay: Number(application.ratePerDay) || 0,
    totalDays: Number(application.totalDays) || 0,
    totalAmount: Number(application.totalAmount) || 0,
    paymentProofUploaded: Boolean(
      application.paymentProofUrl && String(application.paymentProofUrl).trim(),
    ),
    paymentProofFilename: application.paymentProofFilename || "",
    paymentProofUrl: application.paymentProofUrl || "",
    canCancel: !["Acknowledged", "Cancelled"].includes(application.status),
    boardingHostel: application.boardingHostel
      ? {
          _id: application.boardingHostel._id,
          hostel_name: application.boardingHostel.hostel_name || "",
        }
      : null,
    appliedHostel: application.appliedHostel
      ? {
          _id: application.appliedHostel._id,
          hostel_name: application.appliedHostel.hostel_name || "",
        }
      : null,
  };
}

function serializeHostelOption(hostel) {
  if (!hostel) return null;
  return {
    _id: hostel._id,
    hostel_name: hostel.hostel_name || "",
    messId: hostel.messId?._id?.toString() || hostel.messId?.toString() || null,
  };
}

export function serializeSeasonSummary(settings, now = new Date()) {
  if (!settings) return null;

  const pricing = buildSummerMessPricing(settings);

  return {
    _id: settings._id,
    seasonKey: settings.seasonKey || "",
    seasonLabel: settings.seasonLabel || settings.seasonKey || "",
    registration: {
      isOpen: isSummerRegistrationOpen(settings, now),
      startAt: settings.registrationStartAt || null,
      endAt: settings.registrationEndAt || null,
    },
    summer: {
      isActive: isSummerActive(settings),
      startAt: settings.summerStartAt || null,
      endAt: settings.summerEndAt || null,
    },
    participatingHostelCount: Array.isArray(settings.participatingHostels)
      ? settings.participatingHostels.length
      : 0,
    pricing,
    activatedAt: settings.activatedAt || null,
    restoredAt: settings.restoredAt || null,
  };
}

export async function getSummerMessSettingsList({ populate = false } = {}) {
  let query = SummerMessSettings.find();
  if (populate) {
    query = query.populate("participatingHostels", "hostel_name messId");
  }

  const settingsList = await query.lean();
  return settingsList.sort(compareSeasonSettings);
}

export async function findSummerMessSettings({
  seasonId,
  seasonKey,
  populate = false,
} = {}) {
  const filter = {};
  if (seasonId) {
    filter._id = seasonId;
  } else if (seasonKey) {
    filter.seasonKey = seasonKey;
  } else {
    return null;
  }

  let query = SummerMessSettings.findOne(filter);
  if (populate) {
    query = query.populate("participatingHostels", "hostel_name messId");
  }

  return query.lean();
}

export async function getActiveSummerMessSettings({ populate = false } = {}) {
  const list = await getSummerMessSettingsList({ populate });
  const activeSeasons = list.filter((settings) => isSummerActive(settings));
  return activeSeasons.sort((a, b) => compareSeasonSettings(b, a))[0] || null;
}

export async function getOpenSummerRegistrationSettings({
  populate = false,
  now = new Date(),
} = {}) {
  const list = await getSummerMessSettingsList({ populate });
  return (
    list.find((settings) => isSummerRegistrationOpen(settings, now)) || null
  );
}

export async function getUpcomingSummerMessSettings({
  populate = false,
  now = new Date(),
} = {}) {
  const list = await getSummerMessSettingsList({ populate });
  return (
    list.find(
      (settings) =>
        !isSummerActive(settings) && isFutureOrPendingSeason(settings, now),
    ) || null
  );
}

function formatSeasonName(settings) {
  return settings?.seasonLabel || settings?.seasonKey || "summer mess season";
}

async function findSummerMessSettingsDocById(seasonId) {
  if (!seasonId) return null;
  return SummerMessSettings.findById(seasonId);
}

export async function openSummerRegistrationForSeason({
  seasonId,
  now = new Date(),
} = {}) {
  const settings = await findSummerMessSettingsDocById(seasonId);
  if (!settings) {
    throw new Error("Summer mess season not found");
  }

  const openRegistrationSeason = await getOpenSummerRegistrationSettings({
    now,
  });
  if (
    openRegistrationSeason &&
    String(openRegistrationSeason._id) !== String(settings._id)
  ) {
    throw new Error(
      `Registration is already open for ${formatSeasonName(openRegistrationSeason)}`,
    );
  }

  settings.isRegistrationOpen = true;
  await settings.save();
  return settings;
}

export async function closeSummerRegistrationForSeason({ seasonId } = {}) {
  const settings = await findSummerMessSettingsDocById(seasonId);
  if (!settings) {
    throw new Error("Summer mess season not found");
  }

  settings.isRegistrationOpen = false;
  await settings.save();
  return settings;
}

export async function activateSummerSeason({
  seasonId,
  activatedAt = new Date(),
} = {}) {
  const settings = await findSummerMessSettingsDocById(seasonId);
  if (!settings) {
    throw new Error("Summer mess season not found");
  }

  const activeSeason = await getActiveSummerMessSettings();
  if (activeSeason && String(activeSeason._id) !== String(settings._id)) {
    throw new Error(
      `Another summer mess is already active: ${formatSeasonName(activeSeason)}. Restore it before activating a new one.`,
    );
  }

  if (!settings.summerStartAt || !settings.summerEndAt) {
    throw new Error("Set both summer start and end dates before activation");
  }

  settings.isRegistrationOpen = false;
  settings.isSummerActive = true;
  settings.activatedAt = activatedAt;
  settings.restoredAt = null;
  await settings.save();

  const activatedCount = await activateSummerMessAssignments(
    settings.toObject(),
  );
  return {
    settings,
    activatedCount,
  };
}

export async function restoreSummerSeason({
  seasonId,
  restoredAt = new Date(),
} = {}) {
  const settings = await findSummerMessSettingsDocById(seasonId);
  if (!settings) {
    throw new Error("Summer mess season not found");
  }

  settings.isSummerActive = false;
  settings.restoredAt = restoredAt;
  await settings.save();

  const restoredCount = await restoreDefaultMessAssignments();
  return {
    settings,
    restoredCount,
  };
}

function pickAdminSeasonSettings(settingsList, { seasonId, seasonKey, now }) {
  if (seasonId) {
    return (
      settingsList.find(
        (settings) => String(settings._id) === String(seasonId),
      ) || null
    );
  }
  if (seasonKey) {
    return (
      settingsList.find(
        (settings) => settings.seasonKey === String(seasonKey),
      ) || null
    );
  }

  const openRegistrationSeason =
    settingsList.find((settings) => isSummerRegistrationOpen(settings, now)) ||
    null;
  if (openRegistrationSeason) return openRegistrationSeason;

  const upcomingSeason =
    settingsList.find(
      (settings) =>
        !isSummerActive(settings) && isFutureOrPendingSeason(settings, now),
    ) || null;
  if (upcomingSeason) return upcomingSeason;

  const activeSeason =
    settingsList.find((settings) => isSummerActive(settings)) || null;
  if (activeSeason) return activeSeason;

  return pickLatestSeason(settingsList);
}

export async function buildSummerMessAdminPayload({
  seasonId,
  seasonKey,
  now = new Date(),
} = {}) {
  const settingsList = await getSummerMessSettingsList({ populate: true });
  const selectedSettings = pickAdminSeasonSettings(settingsList, {
    seasonId,
    seasonKey,
    now,
  });
  const activeSeason =
    settingsList.find((settings) => isSummerActive(settings)) || null;
  const openRegistrationSeason =
    settingsList.find((settings) => isSummerRegistrationOpen(settings, now)) ||
    null;

  return {
    settings: selectedSettings || null,
    seasons: [...settingsList]
      .sort((a, b) => compareSeasonSettings(b, a))
      .map((settings) => serializeSeasonSummary(settings, now)),
    meta: {
      selectedSeasonId: selectedSettings?._id?.toString() || null,
      activeSeason: serializeSeasonSummary(activeSeason, now),
      openRegistrationSeason: serializeSeasonSummary(
        openRegistrationSeason,
        now,
      ),
    },
  };
}

export async function findClashingSummerMessSettings({
  summerStartAt,
  summerEndAt,
  excludeId,
} = {}) {
  const start = toDateOrNull(summerStartAt);
  const end = toDateOrNull(summerEndAt);
  if (!start || !end) return [];

  const query = {
    summerStartAt: { $ne: null },
    summerEndAt: { $ne: null },
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const settingsList = await SummerMessSettings.find(query)
    .select("seasonKey seasonLabel summerStartAt summerEndAt")
    .lean();

  return settingsList.filter((settings) =>
    isSummerWindowClashing({
      summerStartAt: start,
      summerEndAt: end,
      otherSummerStartAt: settings.summerStartAt,
      otherSummerEndAt: settings.summerEndAt,
    }),
  );
}

async function loadUserForSummerStatus(userId) {
  return User.findById(userId)
    .select(
      "name rollNumber email hasMicrosoftLinked hostel curr_subscribed_mess applied_for_mess_changed",
    )
    .populate("hostel", "hostel_name")
    .populate("curr_subscribed_mess", "hostel_name")
    .lean();
}

function pickUserStatusSeasonSettings({
  settingsList,
  applicationsBySeasonKey,
  now,
}) {
  const openRegistrationSeason =
    settingsList.find((settings) => isSummerRegistrationOpen(settings, now)) ||
    null;
  const activeSeason =
    settingsList.find((settings) => isSummerActive(settings)) || null;

  if (
    openRegistrationSeason &&
    applicationsBySeasonKey.has(openRegistrationSeason.seasonKey)
  ) {
    return openRegistrationSeason;
  }

  const futureApplicationSeason =
    settingsList.find(
      (settings) =>
        applicationsBySeasonKey.has(settings.seasonKey) &&
        !isSummerActive(settings) &&
        isFutureOrPendingSeason(settings, now),
    ) || null;
  if (futureApplicationSeason) {
    return futureApplicationSeason;
  }

  if (openRegistrationSeason) {
    return openRegistrationSeason;
  }

  if (activeSeason && applicationsBySeasonKey.has(activeSeason.seasonKey)) {
    return activeSeason;
  }

  if (activeSeason) {
    return activeSeason;
  }

  return (
    settingsList.find((settings) =>
      applicationsBySeasonKey.has(settings.seasonKey),
    ) || pickLatestSeason(settingsList)
  );
}

export async function buildSummerMessStatusForUser(userId) {
  const [settingsList, user, applications] = await Promise.all([
    getSummerMessSettingsList({ populate: true }),
    loadUserForSummerStatus(userId),
    SummerMessApplication.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("boardingHostel", "hostel_name")
      .populate("appliedHostel", "hostel_name messId")
      .lean(),
  ]);

  if (!user) return null;

  const now = new Date();

  const applicationsBySeasonKey = new Map(
    applications.map((application) => [application.seasonKey, application]),
  );

  const selectedSettings = pickUserStatusSeasonSettings({
    settingsList,
    applicationsBySeasonKey,
    now,
  });

  // Only latest non-cancelled application of selected season
  const selectedApplication = selectedSettings
    ? applications.find(
        (application) =>
          application.seasonKey === selectedSettings.seasonKey &&
          application.status !== "Cancelled",
      ) || null
    : null;

  const activeSeason =
    settingsList.find((settings) => settings && isSummerActive(settings)) ||
    null;

  const registrationOpen = selectedSettings
    ? isSummerRegistrationOpen(selectedSettings, now)
    : false;

  const summerActive = selectedSettings
    ? isSummerActive(selectedSettings)
    : false;

  const availableHostels = (selectedSettings?.participatingHostels || [])
    .filter((hostel) => hostel?.messId)
    .map(serializeHostelOption)
    .filter(Boolean);

  const pricing = buildSummerMessPricing(selectedSettings);

  const isStudentSummerUser =
    Boolean(user.hostel?._id) && Boolean(user.rollNumber);

  const hasAcknowledgedApplication =
    selectedApplication?.status === "Acknowledged";

  const canApply =
    registrationOpen &&
    isStudentSummerUser &&
    user.hasMicrosoftLinked !== false &&
    !hasAcknowledgedApplication;

  return {
    seasonKey: selectedSettings?.seasonKey || defaultSeasonKey(now),

    seasonLabel: selectedSettings?.seasonLabel || defaultSeasonLabel(now),

    shouldShowCard: Boolean(
      selectedApplication ||
      (isStudentSummerUser &&
        selectedSettings &&
        (registrationOpen || summerActive)),
    ),

    registration: {
      isOpen: registrationOpen,
      startAt: selectedSettings?.registrationStartAt || null,
      endAt: selectedSettings?.registrationEndAt || null,
    },

    summer: {
      isActive: summerActive,
      startAt: selectedSettings?.summerStartAt || null,
      endAt: selectedSettings?.summerEndAt || null,
    },

    pricing,

    activeSeason: serializeSeasonSummary(activeSeason, now),

    canApply,

    availableHostels,

    // null if no non-cancelled application exists for this season
    application: serializeApplication(selectedApplication),

    studentProfile: {
      name: user.name || "",
      rollNumber: user.rollNumber || "",
      email: user.email || "",
    },

    boardingHostel: user.hostel
      ? {
          _id: user.hostel._id,
          hostel_name: user.hostel.hostel_name || "",
        }
      : null,

    currentSubscription: user.curr_subscribed_mess
      ? {
          _id: user.curr_subscribed_mess._id,
          hostel_name: user.curr_subscribed_mess.hostel_name || "",
        }
      : null,
  };
}

export function pickManagerSeasonSettings(
  settingsList,
  { seasonId, seasonKey, now = new Date() } = {},
) {
  if (seasonId) {
    return (
      settingsList.find(
        (settings) => String(settings._id) === String(seasonId),
      ) || null
    );
  }
  if (seasonKey) {
    return (
      settingsList.find(
        (settings) => settings.seasonKey === String(seasonKey),
      ) || null
    );
  }

  const openRegistrationSeason =
    settingsList.find((settings) => isSummerRegistrationOpen(settings, now)) ||
    null;
  if (openRegistrationSeason) return openRegistrationSeason;

  const upcomingSeason =
    settingsList.find(
      (settings) =>
        !isSummerActive(settings) && isFutureOrPendingSeason(settings, now),
    ) || null;
  if (upcomingSeason) return upcomingSeason;

  const activeSeason =
    settingsList.find((settings) => isSummerActive(settings)) || null;
  if (activeSeason) return activeSeason;

  return pickLatestSeason(settingsList);
}

export async function assignSummerMessToUser({
  userId,
  appliedHostelId,
  session,
}) {
  const user = await User.findById(userId).select("rollNumber").lean();
  if (!user) return false;

  await User.updateOne(
    { _id: userId },
    { $set: { curr_subscribed_mess: appliedHostelId } },
    session ? { session } : undefined,
  );

  if (user.rollNumber) {
    await UserAllocHostel.updateOne(
      { rollno: user.rollNumber },
      { $set: { current_subscribed_mess: appliedHostelId } },
      session ? { session } : undefined,
    );
  }

  return true;
}

async function activateSummerMessAssignmentsInternal(settings, session) {
  const acknowledgedApplications = await SummerMessApplication.find({
    seasonKey: settings.seasonKey,
    status: "Acknowledged",
  })
    .populate("user", "rollNumber")
    .select("user appliedHostel")
    .lean();

  const users = await User.find({}).select("_id").lean();
  const allocations = await UserAllocHostel.find({}).select("_id").lean();

  const userResetOps = users.map((user) => ({
    updateOne: {
      filter: { _id: user._id },
      update: { $set: { curr_subscribed_mess: null } },
    },
  }));
  const allocResetOps = allocations.map((alloc) => ({
    updateOne: {
      filter: { _id: alloc._id },
      update: { $set: { current_subscribed_mess: null } },
    },
  }));

  const acknowledgedUserOps = [];
  const acknowledgedAllocOps = [];

  for (const application of acknowledgedApplications) {
    const appliedHostelId =
      application.appliedHostel?._id || application.appliedHostel;
    if (!appliedHostelId || !application.user?._id) continue;

    acknowledgedUserOps.push({
      updateOne: {
        filter: { _id: application.user._id },
        update: { $set: { curr_subscribed_mess: appliedHostelId } },
      },
    });

    if (application.user.rollNumber) {
      acknowledgedAllocOps.push({
        updateOne: {
          filter: { rollno: application.user.rollNumber },
          update: { $set: { current_subscribed_mess: appliedHostelId } },
        },
      });
    }
  }

  if (userResetOps.length > 0) {
    await User.bulkWrite(userResetOps, { session });
  }
  if (allocResetOps.length > 0) {
    await UserAllocHostel.bulkWrite(allocResetOps, { session });
  }
  if (acknowledgedUserOps.length > 0) {
    await User.bulkWrite(acknowledgedUserOps, { session });
  }
  if (acknowledgedAllocOps.length > 0) {
    await UserAllocHostel.bulkWrite(acknowledgedAllocOps, { session });
  }

  if (acknowledgedApplications.length > 0) {
    const messChangedAt = new Date();
    const applicationOps = acknowledgedApplications
      .filter((application) => !application.messChangedAt)
      .map((application) => ({
        updateOne: {
          filter: { _id: application._id },
          update: { $set: { messChangedAt } },
        },
      }));
    if (applicationOps.length > 0) {
      await SummerMessApplication.bulkWrite(applicationOps, { session });
    }
  }

  return acknowledgedApplications.length;
}

async function restoreDefaultMessAssignmentsInternal(session) {
  const allocations = await UserAllocHostel.find({})
    .select("_id hostel")
    .lean();
  const users = await User.find({}).select("_id hostel").lean();

  const allocOps = allocations.map((alloc) => ({
    updateOne: {
      filter: { _id: alloc._id },
      update: { $set: { current_subscribed_mess: alloc.hostel || null } },
    },
  }));
  const userOps = users.map((user) => ({
    updateOne: {
      filter: { _id: user._id },
      update: { $set: { curr_subscribed_mess: user.hostel || null } },
    },
  }));

  if (allocOps.length > 0) {
    await UserAllocHostel.bulkWrite(allocOps, { session });
  }
  if (userOps.length > 0) {
    await User.bulkWrite(userOps, { session });
  }

  return users.length;
}

async function clearSummerMessCaches() {
  await redisClient.del("all_mess_info");
  await clearCacheByPattern("hostel_*");
}

export async function activateSummerMessAssignments(settings) {
  const updatedCount = await withTransaction(async (session) => {
    return activateSummerMessAssignmentsInternal(settings, session);
  });
  await clearSummerMessCaches();
  return updatedCount;
}

export async function restoreDefaultMessAssignments() {
  const restoredCount = await withTransaction(async (session) => {
    return restoreDefaultMessAssignmentsInternal(session);
  });
  await clearSummerMessCaches();
  return restoredCount;
}

export async function isSummerMessActiveNow() {
  const settings = await SummerMessSettings.findOne({ isSummerActive: true })
    .select("_id")
    .lean();
  return Boolean(settings?._id);
}
