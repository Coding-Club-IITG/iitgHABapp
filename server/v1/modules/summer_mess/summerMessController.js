import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";

import { withTransaction } from "../../utils/withTransaction.js";

import { Hostel } from "../hostel/hostelModel.js";
import { User } from "../user/userModel.js";
import UserAllocHostel from "../hostel/hostelAllocModel.js";

import { SummerMessApplication } from "./summerMessApplicationModel.js";
import {
  SummerMessAutomationLockedError,
  withSummerMessAutomationLock,
} from "./summerMessAutomationLock.js";
import { SummerMessSettings } from "./summerMessSettingsModel.js";
import {
  activateSummerSeason,
  assignSummerMessToUser,
  buildSummerMessPricing,
  buildSummerMessAdminPayload,
  buildSummerMessStatusForUser,
  closeSummerRegistrationForSeason,
  defaultSeasonKey,
  defaultSeasonLabel,
  findClashingSummerMessSettings,
  getActiveSummerMessSettings,
  getOpenSummerRegistrationSettings,
  getSummerMessSettingsList,
  isSummerActive,
  isSummerRegistrationOpen,
  openSummerRegistrationForSeason,
  pickManagerSeasonSettings,
  restoreSummerSeason,
  serializeSeasonSummary,
} from "./summerMessService.js";
import { sendSummerMessDocument } from "./summerMessUploadController.js";

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function ensureObjectId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function parseDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseBooleanLike(value) {
  if (value === true || value === false) return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return false;
}

function parseNonNegativeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeSeasonLabel(label, seasonKey, now = new Date()) {
  const trimmed = String(label || "").trim();
  if (trimmed) return trimmed;

  if (seasonKey?.startsWith("summer-")) {
    return seasonKey.replace(/^summer-/, "Summer ");
  }

  return defaultSeasonLabel(now);
}

async function ensureSettingsIdentity(settings) {
  if (!settings) return;

  if (!String(settings.seasonKey || "").trim()) {
    settings.seasonKey = await buildUniqueSeasonKey(null, settings._id || null);
  }
  if (!String(settings.seasonLabel || "").trim()) {
    settings.seasonLabel = normalizeSeasonLabel(
      settings.seasonLabel,
      settings.seasonKey,
      settings.summerStartAt || settings.registrationStartAt || new Date(),
    );
  }
}

async function buildUniqueSeasonKey(requestedSeasonKey, excludeId) {
  const trimmedKey = String(requestedSeasonKey || "").trim();
  const filterWithoutId = excludeId ? { _id: { $ne: excludeId } } : {};

  if (trimmedKey) {
    const existing = await SummerMessSettings.findOne({
      seasonKey: trimmedKey,
      ...filterWithoutId,
    })
      .select("_id")
      .lean();
    return existing ? null : trimmedKey;
  }

  const baseKey = defaultSeasonKey();
  let candidateKey = baseKey;
  let suffix = 2;

  while (true) {
    const existing = await SummerMessSettings.findOne({
      seasonKey: candidateKey,
      ...filterWithoutId,
    })
      .select("_id")
      .lean();
    if (!existing) return candidateKey;
    candidateKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }
}

async function resolveSettingsDocument({ seasonId, seasonKey } = {}) {
  if (seasonId) {
    const normalizedSeasonId = ensureObjectId(seasonId);
    if (!normalizedSeasonId) return null;
    return SummerMessSettings.findById(normalizedSeasonId);
  }

  if (seasonKey) {
    return SummerMessSettings.findOne({ seasonKey: String(seasonKey).trim() });
  }

  return null;
}

function extractSeasonSelection(req) {
  return {
    seasonId: req.query?.seasonId || req.body?.seasonId || null,
    seasonKey: req.query?.seasonKey || req.body?.seasonKey || null,
  };
}

async function validateParticipatingHostels(hostelIds) {
  const normalizedIds = (Array.isArray(hostelIds) ? hostelIds : [])
    .map((id) => ensureObjectId(id))
    .filter(Boolean);

  if (normalizedIds.length === 0) return [];

  const hostels = await Hostel.find({
    _id: { $in: normalizedIds },
    messId: { $ne: null },
  })
    .select("hostel_name messId")
    .lean();

  if (hostels.length !== normalizedIds.length) {
    return null;
  }

  return hostels;
}

async function populateApplication(applicationId) {
  return SummerMessApplication.findById(applicationId)
    .populate("user", "name rollNumber email hostel curr_subscribed_mess")
    .populate("boardingHostel", "hostel_name")
    .populate("appliedHostel", "hostel_name");
}

function validateDateRangeOrSend(
  res,
  { registrationStartAt, registrationEndAt, summerStartAt, summerEndAt },
) {
  if (registrationStartAt && !registrationStartAt.getTime()) {
    res.status(400).json({ message: "registrationStartAt is invalid" });
    return false;
  }
  if (registrationEndAt && !registrationEndAt.getTime()) {
    res.status(400).json({ message: "registrationEndAt is invalid" });
    return false;
  }
  if (summerStartAt && !summerStartAt.getTime()) {
    res.status(400).json({ message: "summerStartAt is invalid" });
    return false;
  }
  if (summerEndAt && !summerEndAt.getTime()) {
    res.status(400).json({ message: "summerEndAt is invalid" });
    return false;
  }
  if (
    registrationStartAt &&
    registrationEndAt &&
    registrationStartAt > registrationEndAt
  ) {
    res.status(400).json({
      message: "registrationStartAt must be before registrationEndAt",
    });
    return false;
  }
  if (summerStartAt && summerEndAt && summerStartAt > summerEndAt) {
    res.status(400).json({
      message: "summerStartAt must be before summerEndAt",
    });
    return false;
  }

  return true;
}

async function ensureSummerWindowDoesNotClash({
  summerStartAt,
  summerEndAt,
  excludeId,
}) {
  if (!summerStartAt || !summerEndAt) return null;

  const clashes = await findClashingSummerMessSettings({
    summerStartAt,
    summerEndAt,
    excludeId,
  });

  return clashes[0] || null;
}

export const getSummerMessStatus = async (req, res) => {
  try {
    const data = await buildSummerMessStatusForUser(getUserId(req));
    return res.status(200).json(data || {});
  } catch (error) {
    logger.error("getSummerMessStatus:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const registerForSummerMess = async (req, res) => {
  try {
    const user = await User.findById(getUserId(req)).select(
      "hostel rollNumber hasMicrosoftLinked",
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.hostel || !user.rollNumber || user.hasMicrosoftLinked === false) {
      return res.status(400).json({
        message:
          "Summer mess registration is available only for students with a hostel allocation and Microsoft-linked account",
      });
    }

    const settings = await getOpenSummerRegistrationSettings();
    if (!settings) {
      return res
        .status(403)
        .json({ message: "Summer mess registration is currently closed" });
    }

    const registrationTermsAccepted = parseBooleanLike(
      req.body?.registrationTermsAccepted,
    );
    if (!registrationTermsAccepted) {
      return res.status(400).json({
        message: "Please accept the summer mess terms before registering",
      });
    }

    const paymentProofDeclarationAccepted = parseBooleanLike(
      req.body?.paymentProofDeclarationAccepted,
    );
    if (!paymentProofDeclarationAccepted) {
      return res.status(400).json({
        message: "Please confirm that the uploaded payment proof is valid",
      });
    }

    const paymentProofUrl = req.uploadedDocuments?.paymentProof?.url || "";
    const paymentProofFilename =
      req.uploadedDocuments?.paymentProof?.filename || "";
    if (!paymentProofUrl) {
      return res.status(400).json({
        message: "Payment proof upload is required",
      });
    }

    const appliedHostelId = ensureObjectId(req.body?.hostelId);
    if (!appliedHostelId) {
      return res.status(400).json({ message: "Valid hostelId is required" });
    }

    const participatingIds = (settings.participatingHostels || []).map((id) =>
      id.toString(),
    );
    if (!participatingIds.includes(appliedHostelId.toString())) {
      return res.status(400).json({
        message: "Selected hostel is not accepting summer mess registrations",
      });
    }

    const appliedHostel = await Hostel.findOne({
      _id: appliedHostelId,
      messId: { $ne: null },
    })
      .select("hostel_name")
      .lean();
    if (!appliedHostel) {
      return res
        .status(404)
        .json({ message: "Selected hostel is not available for summer mess" });
    }

    const existing = await SummerMessApplication.findOne({
      user: user._id,
      seasonKey: settings.seasonKey,
      status: { $ne: "Cancelled" },
    });

    if (existing?.status === "Acknowledged") {
      return res.status(400).json({
        message:
          "Your summer mess application has already been acknowledged and cannot be changed",
      });
    }

    const pricing = buildSummerMessPricing(settings);

    const update = {
      boardingHostel: user.hostel,
      appliedHostel: appliedHostelId,
      ratePerDay: pricing.ratePerDay,
      totalDays: pricing.totalDays,
      totalAmount: pricing.totalAmount,
      paymentProofUrl,
      paymentProofFilename,
      registrationTermsAccepted,
      paymentProofDeclarationAccepted,
      status: "Pending",
      acknowledgedAt: null,
      acknowledgedByHostel: null,
    };

    const application = existing
      ? await SummerMessApplication.findByIdAndUpdate(existing._id, update, {
          new: true,
        })
      : await SummerMessApplication.create({
          user: user._id,
          seasonKey: settings.seasonKey,
          ...update,
        });

    const populated = await populateApplication(application._id);

    return res.status(200).json({
      message: existing
        ? "Summer mess registration updated"
        : "Registered for summer mess",
      application: populated,
    });
  } catch (error) {
    logger.error("registerForSummerMess:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const cancelSummerMessApplication = async (req, res) => {
  try {
    const application = await SummerMessApplication.findById(req.params.id);
    if (!application || String(application.user) !== String(getUserId(req))) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (["Acknowledged", "Cancelled"].includes(application.status)) {
      return res.status(400).json({
        message: "This summer mess application can no longer be cancelled",
      });
    }

    application.status = "Cancelled";
    application.acknowledgedAt = null;
    application.acknowledgedByHostel = null;
    await application.save();

    const populated = await populateApplication(application._id);
    return res.status(200).json({
      message: "Summer mess application cancelled",
      application: populated,
    });
  } catch (error) {
    logger.error("cancelSummerMessApplication:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// (unsubscribeSummerMess removed — server-side unsubscribe handled elsewhere if needed)

export const getSummerMessAdminApplications = async (req, res) => {
  try {
    const now = new Date();
    const settingsList = await getSummerMessSettingsList();
    const selectedSettings = pickManagerSeasonSettings(settingsList, {
      seasonId: req.query?.seasonId || null,
      seasonKey: req.query?.seasonKey || null,
      now,
    });
    const seasonKey = selectedSettings?.seasonKey || defaultSeasonKey(now);
    const status = String(req.query?.status || "").trim();
    const hostelId = req.query?.hostelId
      ? ensureObjectId(req.query.hostelId)
      : null;

    const query = {
      seasonKey,
    };
    if (status && status.toLowerCase() !== "all") {
      query.status = status;
    }
    if (hostelId) {
      query.appliedHostel = hostelId;
    }

    const applications = await SummerMessApplication.find(query)
      .sort({ createdAt: -1 })
      .populate("user", "name rollNumber email hostel curr_subscribed_mess")
      .populate("boardingHostel", "hostel_name")
      .populate("appliedHostel", "hostel_name")
      .lean();

    // Group applications by hostel and status
    const groupedByHostel = {};
    applications.forEach((app) => {
      const hostelName = app.appliedHostel?.hostel_name || "Unknown Hostel";
      const hostelId = app.appliedHostel?._id?.toString() || "unknown";
      if (!groupedByHostel[hostelId]) {
        groupedByHostel[hostelId] = {
          hostelName,
          hostelId,
          pending: [],
          acknowledged: [],
        };
      }
      if (app.status === "Pending") {
        groupedByHostel[hostelId].pending.push(app);
      } else if (app.status === "Acknowledged") {
        groupedByHostel[hostelId].acknowledged.push(app);
      }
    });

    return res.status(200).json({
      seasonId: selectedSettings?._id || null,
      seasonKey,
      seasonLabel:
        selectedSettings?.seasonLabel ||
        selectedSettings?.seasonKey ||
        defaultSeasonLabel(now),
      registration: selectedSettings
        ? {
            isOpen: isSummerRegistrationOpen(selectedSettings, now),
            startAt: selectedSettings.registrationStartAt || null,
            endAt: selectedSettings.registrationEndAt || null,
          }
        : null,
      summer: selectedSettings
        ? {
            isActive: isSummerActive(selectedSettings),
            startAt: selectedSettings.summerStartAt || null,
            endAt: selectedSettings.summerEndAt || null,
          }
        : null,
      seasons: settingsList.map((settings) =>
        serializeSeasonSummary(settings, now),
      ),
      applications,
      groupedByHostel,
      participatingHostels: selectedSettings?.participatingHostels || [],
    });
  } catch (error) {
    logger.error("getSummerMessAdminApplications:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getManagerSummerMessApplications = async (req, res) => {
  try {
    const now = new Date();
    const settingsList = await getSummerMessSettingsList();
    const selectedSettings = pickManagerSeasonSettings(settingsList, {
      seasonId: req.query?.seasonId || null,
      seasonKey: req.query?.seasonKey || null,
      now,
    });
    const seasonKey = selectedSettings?.seasonKey || defaultSeasonKey(now);
    const status = String(req.query?.status || "Pending").trim();

    const query = {
      appliedHostel: req.managerHostel._id,
      seasonKey,
    };
    if (status && status.toLowerCase() !== "all") {
      query.status = status;
    }

    const applications = await SummerMessApplication.find(query)
      .sort({ createdAt: -1 })
      .populate("user", "name rollNumber email hostel curr_subscribed_mess")
      .populate("boardingHostel", "hostel_name")
      .populate("appliedHostel", "hostel_name")
      .lean();

    return res.status(200).json({
      seasonId: selectedSettings?._id || null,
      seasonKey,
      seasonLabel:
        selectedSettings?.seasonLabel ||
        selectedSettings?.seasonKey ||
        defaultSeasonLabel(now),
      registration: selectedSettings
        ? {
            isOpen: isSummerRegistrationOpen(selectedSettings, now),
            startAt: selectedSettings.registrationStartAt || null,
            endAt: selectedSettings.registrationEndAt || null,
          }
        : null,
      summer: selectedSettings
        ? {
            isActive: isSummerActive(selectedSettings),
            startAt: selectedSettings.summerStartAt || null,
            endAt: selectedSettings.summerEndAt || null,
          }
        : null,
      seasons: settingsList.map((settings) =>
        serializeSeasonSummary(settings, now),
      ),
      applications,
    });
  } catch (error) {
    logger.error("getManagerSummerMessApplications:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const acknowledgeSummerMessApplication = async (req, res) => {
  try {
    const application = await SummerMessApplication.findById(req.params.id);
    if (
      !application ||
      !application.appliedHostel.equals(req.managerHostel._id)
    ) {
      return res.status(404).json({ message: "Application not found" });
    }
    if (application.status !== "Pending") {
      return res.status(400).json({
        message: "This application cannot be acknowledged",
        cause: `Application is already ${application.status}`,
      });
    }
    if (!String(application.paymentProofUrl || "").trim()) {
      return res.status(400).json({
        message: "Payment proof is missing for this application",
      });
    }

    const settings = await SummerMessSettings.findOne({
      seasonKey: application.seasonKey,
    }).lean();
    const acknowledgedAt = new Date();

    await withTransaction(async (session) => {
      await SummerMessApplication.updateOne(
        { _id: application._id },
        {
          $set: {
            status: "Acknowledged",
            acknowledgedAt,
            acknowledgedByHostel: req.managerHostel._id,
            ...(isSummerActive(settings)
              ? { messChangedAt: acknowledgedAt }
              : {}),
          },
        },
        { session },
      );

      if (isSummerActive(settings)) {
        await assignSummerMessToUser({
          userId: application.user,
          appliedHostelId: application.appliedHostel,
          session,
        });
      }
    });

    const updated = await populateApplication(application._id);

    return res.status(200).json({
      message: "Summer mess application acknowledged",
      updatedApplication: updated,
    });
  } catch (error) {
    logger.error("acknowledgeSummerMessApplication:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const streamManagerSummerMessProof = async (req, res) => {
  try {
    const application = await SummerMessApplication.findById(req.params.id)
      .select(
        "appliedHostel paymentProofUrl paymentProofFilename user rollNumber totalAmount",
      )
      .lean();

    if (
      !application ||
      String(application.appliedHostel) !== String(req.managerHostel._id)
    ) {
      return res.status(404).json({ message: "Application not found" });
    }

    return sendSummerMessDocument(application.paymentProofUrl, res, {
      inline: true,
      filename:
        application.paymentProofFilename ||
        `summer-mess-proof-${req.params.id}`,
    });
  } catch (error) {
    logger.error("streamManagerSummerMessProof:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const streamStudentSummerMessProof = async (req, res) => {
  try {
    const application = await SummerMessApplication.findById(req.params.id)
      .select(
        "appliedHostel paymentProofUrl paymentProofFilename user rollNumber totalAmount",
      )
      .lean();

    if (!application || String(application.user) !== String(req.user?._id)) {
      return res.status(404).json({ message: "Application not found" });
    }

    return sendSummerMessDocument(application.paymentProofUrl, res, {
      inline: true,
      filename:
        application.paymentProofFilename ||
        `summer-mess-proof-${req.params.id}`,
    });
  } catch (error) {
    logger.error("streamStudentSummerMessProof:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getSummerMessAdminSettings = async (req, res) => {
  try {
    const payload = await buildSummerMessAdminPayload({
      seasonId: req.query?.seasonId || null,
      seasonKey: req.query?.seasonKey || null,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("getSummerMessAdminSettings:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const upsertSummerMessAdminSettings = async (req, res) => {
  try {
    const {
      seasonId,
      seasonKey,
      seasonLabel,
      registrationStartAt,
      registrationEndAt,
      summerStartAt,
      summerEndAt,
      ratePerDay,
      participatingHostelIds,
      isRegistrationOpen,
    } = req.body || {};

    const participatingHostels = await validateParticipatingHostels(
      participatingHostelIds,
    );
    if (participatingHostels === null) {
      return res.status(400).json({
        message:
          "participatingHostelIds must contain only hostels with an assigned mess",
      });
    }

    const parsedRegistrationStart = parseDateOrNull(registrationStartAt);
    const parsedRegistrationEnd = parseDateOrNull(registrationEndAt);
    const parsedSummerStart = parseDateOrNull(summerStartAt);
    const parsedSummerEnd = parseDateOrNull(summerEndAt);

    if (registrationStartAt && !parsedRegistrationStart) {
      return res
        .status(400)
        .json({ message: "registrationStartAt is invalid" });
    }
    if (registrationEndAt && !parsedRegistrationEnd) {
      return res.status(400).json({ message: "registrationEndAt is invalid" });
    }
    if (summerStartAt && !parsedSummerStart) {
      return res.status(400).json({ message: "summerStartAt is invalid" });
    }
    if (summerEndAt && !parsedSummerEnd) {
      return res.status(400).json({ message: "summerEndAt is invalid" });
    }

    const parsedRatePerDay = parseNonNegativeNumber(ratePerDay);
    if (parsedRatePerDay === null) {
      return res.status(400).json({
        message: "ratePerDay must be a non-negative number",
      });
    }

    if (
      !validateDateRangeOrSend(res, {
        registrationStartAt: parsedRegistrationStart,
        registrationEndAt: parsedRegistrationEnd,
        summerStartAt: parsedSummerStart,
        summerEndAt: parsedSummerEnd,
      })
    ) {
      return;
    }

    const settings = seasonId
      ? await SummerMessSettings.findById(seasonId)
      : null;
    if (seasonId && !settings) {
      return res.status(404).json({ message: "Summer mess season not found" });
    }

    const uniqueSeasonKey = await buildUniqueSeasonKey(
      seasonKey,
      settings?._id || null,
    );
    if (!uniqueSeasonKey) {
      return res.status(400).json({
        message: "seasonKey must be unique across summer mess seasons",
      });
    }

    const clashingSeason = await ensureSummerWindowDoesNotClash({
      summerStartAt: parsedSummerStart,
      summerEndAt: parsedSummerEnd,
      excludeId: settings?._id || null,
    });
    if (clashingSeason) {
      return res.status(400).json({
        message: `Summer period overlaps with ${clashingSeason.seasonLabel || clashingSeason.seasonKey}`,
      });
    }

    const seasonDoc =
      settings ||
      new SummerMessSettings({
        isRegistrationOpen: false,
        isSummerActive: false,
      });
    const wasNew = seasonDoc.isNew;

    const previousSeasonKey = seasonDoc.isNew ? null : seasonDoc.seasonKey;
    const nextSeasonLabel = normalizeSeasonLabel(
      seasonLabel,
      uniqueSeasonKey,
      parsedSummerStart || parsedRegistrationStart || new Date(),
    );

    await withTransaction(async (session) => {
      seasonDoc.seasonKey = uniqueSeasonKey;
      seasonDoc.seasonLabel = nextSeasonLabel;
      seasonDoc.registrationStartAt = parsedRegistrationStart;
      seasonDoc.registrationEndAt = parsedRegistrationEnd;
      seasonDoc.summerStartAt = parsedSummerStart;
      seasonDoc.summerEndAt = parsedSummerEnd;
      seasonDoc.ratePerDay = parsedRatePerDay;
      seasonDoc.participatingHostels = participatingHostels.map(
        (hostel) => hostel._id,
      );
      if (typeof isRegistrationOpen === "boolean") {
        seasonDoc.isRegistrationOpen = isRegistrationOpen;
      }

      await seasonDoc.save({ session });

      if (previousSeasonKey && previousSeasonKey !== uniqueSeasonKey) {
        await SummerMessApplication.updateMany(
          { seasonKey: previousSeasonKey },
          { $set: { seasonKey: uniqueSeasonKey } },
          { session },
        );
      }
    });

    const payload = await buildSummerMessAdminPayload({
      seasonId: seasonDoc._id.toString(),
    });

    return res.status(200).json({
      message: wasNew
        ? "Summer mess season created"
        : "Summer mess settings saved",
      ...payload,
    });
  } catch (error) {
    logger.error("upsertSummerMessAdminSettings:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const openSummerMessRegistration = async (req, res) => {
  try {
    return await withSummerMessAutomationLock(async () => {
      const selection = extractSeasonSelection(req);
      const settings = await resolveSettingsDocument(selection);
      if (!settings) {
        return res
          .status(404)
          .json({ message: "Summer mess season not found" });
      }

      await ensureSettingsIdentity(settings);
      await openSummerRegistrationForSeason({ seasonId: settings._id });

      const payload = await buildSummerMessAdminPayload({
        seasonId: settings._id.toString(),
      });

      return res.status(200).json({
        message: "Summer mess registration opened",
        ...payload,
      });
    });
  } catch (error) {
    if (error instanceof SummerMessAutomationLockedError) {
      return res.status(409).json({
        message: "Another summer mess transition is already in progress",
      });
    }
    logger.error("openSummerMessRegistration:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const closeSummerMessRegistration = async (req, res) => {
  try {
    return await withSummerMessAutomationLock(async () => {
      const selection = extractSeasonSelection(req);
      const settings = await resolveSettingsDocument(selection);
      if (!settings) {
        return res
          .status(404)
          .json({ message: "Summer mess season not found" });
      }

      await ensureSettingsIdentity(settings);
      await closeSummerRegistrationForSeason({ seasonId: settings._id });

      const payload = await buildSummerMessAdminPayload({
        seasonId: settings._id.toString(),
      });

      return res.status(200).json({
        message: "Summer mess registration closed",
        ...payload,
      });
    });
  } catch (error) {
    if (error instanceof SummerMessAutomationLockedError) {
      return res.status(409).json({
        message: "Another summer mess transition is already in progress",
      });
    }
    logger.error("closeSummerMessRegistration:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const activateSummerMess = async (req, res) => {
  try {
    return await withSummerMessAutomationLock(async () => {
      const selection = extractSeasonSelection(req);
      const settings = await resolveSettingsDocument(selection);
      if (!settings) {
        return res.status(404).json({
          message: "Summer mess season not found",
        });
      }

      await ensureSettingsIdentity(settings);
      const clashingSeason = await ensureSummerWindowDoesNotClash({
        summerStartAt: settings.summerStartAt,
        summerEndAt: settings.summerEndAt,
        excludeId: settings._id,
      });
      if (clashingSeason) {
        return res.status(400).json({
          message: `Summer period overlaps with ${clashingSeason.seasonLabel || clashingSeason.seasonKey}`,
        });
      }

      const { activatedCount } = await activateSummerSeason({
        seasonId: settings._id,
        activatedAt: new Date(),
      });
      const payload = await buildSummerMessAdminPayload({
        seasonId: settings._id.toString(),
      });

      return res.status(200).json({
        message: "Summer mess activated successfully",
        seasonKey: settings.seasonKey,
        activatedCount,
        ...payload,
      });
    });
  } catch (error) {
    if (error instanceof SummerMessAutomationLockedError) {
      return res.status(409).json({
        message: "Another summer mess transition is already in progress",
      });
    }
    logger.error("activateSummerMess:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const restoreSummerMess = async (req, res) => {
  try {
    return await withSummerMessAutomationLock(async () => {
      const activeSettingsDoc = await SummerMessSettings.findOne({
        isSummerActive: true,
      }).sort({ activatedAt: -1, summerStartAt: -1, createdAt: -1 });

      if (!activeSettingsDoc) {
        return res.status(400).json({
          message: "No active summer mess season to restore",
        });
      }

      await ensureSettingsIdentity(activeSettingsDoc);
      const { restoredCount } = await restoreSummerSeason({
        seasonId: activeSettingsDoc._id,
        restoredAt: new Date(),
      });
      const payload = await buildSummerMessAdminPayload();

      return res.status(200).json({
        message: "Summer mess subscriptions restored to boarding hostels",
        restoredCount,
        ...payload,
      });
    });
  } catch (error) {
    if (error instanceof SummerMessAutomationLockedError) {
      return res.status(409).json({
        message: "Another summer mess transition is already in progress",
      });
    }
    logger.error("restoreSummerMess:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const deleteSummerMessSeason = async (req, res) => {
  try {
    const seasonId = req.params?.id || req.query?.seasonId || null;
    if (!seasonId) {
      return res.status(400).json({ message: "season id is required" });
    }

    const settings = await SummerMessSettings.findById(seasonId);
    if (!settings) {
      return res.status(404).json({ message: "Summer mess season not found" });
    }

    const seasonKey = settings.seasonKey;

    await withTransaction(async (session) => {
      // remove applications belonging to this season
      if (seasonKey) {
        await SummerMessApplication.deleteMany({ seasonKey }, { session });
      }
      // remove the settings document
      await SummerMessSettings.deleteOne({ _id: settings._id }, { session });
    });

    const payload = await buildSummerMessAdminPayload();
    return res
      .status(200)
      .json({ message: "Season and its applications deleted", ...payload });
  } catch (error) {
    logger.error("deleteSummerMessSeason:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
