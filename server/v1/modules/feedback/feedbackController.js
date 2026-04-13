import { User } from "../user/userModel.js";
import { Hostel } from "../hostel/hostelModel.js";
import { Mess } from "../mess/messModel.js";
import UserAllocHostel from "../hostel/hostelAllocModel.js";
import Feedback from "./feedbackModel.js";
import FeedbackWindowStats from "./feedbackWindowStatsModel.js";
import { FeedbackSettings } from "./feedbackSettingsModel.js";

import { sendNotificationMessage } from "../notification/notificationController.js";
import {
  generateOpiReport,
  saveOpiReportBackup,
} from "./opiReportGenerator.js";

import {
  getFeedbackWindowDates,
  getOrdinalSuffix,
} from "../../utils/windowDates.js";
import redisClient from "../../utils/redisClient.js";
import { uploadReportToOnedrive } from "../../utils/onedriveController.js";
import { withTransaction } from "../../utils/withTransaction.js";

// Rating helpers
const ratingMap = {
  "Very Poor": 1,
  Poor: 2,
  Average: 3,
  Good: 4,
  "Very Good": 5,
};

// centralize cache key naming so invalidation and reads stay consistent.
const CACHE_KEYS = {
  settings: "feedback_settings",
  windows: "feedback_available_windows",
  allTimeLeaderboard: "feedback_leaderboard_all",
  windowLeaderboard: (windowNumber) =>
    `feedback_leaderboard_window_${windowNumber}`,
};

const CACHE_TTL_SECONDS = {
  settings: 60,
  leaderboard: 90,
  windows: 120,
};

// local hot cache keeps API responsive when Redis is unavailable/slow.
const localHotCache = new Map();

// strict parser prevents permissive parseInt behavior (e.g. "12abc" -> 12).
const parseWindowNumberStrict = (rawWindowNumber, { required = false } = {}) => {
  if (rawWindowNumber === undefined || rawWindowNumber === null || rawWindowNumber === "") {
    if (required) {
      return { ok: false, message: "windowNumber is required" };
    }
    return { ok: true, value: null };
  }

  const trimmed = String(rawWindowNumber).trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: "windowNumber must be a positive integer" };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { ok: false, message: "windowNumber must be a positive integer" };
  }

  return { ok: true, value: parsed };
};

const setLocalHotCache = (key, value, ttlSeconds) => {
  localHotCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

const getLocalHotCache = (key) => {
  const entry = localHotCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localHotCache.delete(key);
    return null;
  }
  return entry.value;
};

const deleteLocalHotCache = (key) => {
  localHotCache.delete(key);
};

const getCachedJson = async (key, ttlSeconds = CACHE_TTL_SECONDS.leaderboard) => {
  try {
    const fromRedis = await redisClient.get(key);
    if (fromRedis) {
      const parsed = JSON.parse(fromRedis);
      setLocalHotCache(key, parsed, ttlSeconds);
      return parsed;
    }
  } catch (error) {
    // degrade gracefully to local in-process cache instead of failing the request.
    console.error("[FEEDBACK] Redis get failed, using local hot cache:", key, error?.message || error);
  }
  return getLocalHotCache(key);
};

const setCachedJson = async (key, value, ttlSeconds) => {
  setLocalHotCache(key, value, ttlSeconds);
  try {
    await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    // keep response path non-blocking even when Redis write fails.
    console.error("[FEEDBACK] Redis set failed, local hot cache retained:", key, error?.message || error);
  }
};

// clear all derived caches whenever feedback state changes to avoid stale rankings/settings.
const invalidateFeedbackCaches = async ({ windowNumber = null } = {}) => {
  const keys = [
    CACHE_KEYS.settings,
    CACHE_KEYS.windows,
    CACHE_KEYS.allTimeLeaderboard,
  ];
  if (typeof windowNumber === "number") {
    keys.push(CACHE_KEYS.windowLeaderboard(windowNumber));
  }

  keys.forEach(deleteLocalHotCache);

  try {
    await Promise.all(keys.map((key) => redisClient.del(key)));
  } catch (error) {
    console.error("[FEEDBACK] Redis cache invalidation failed:", error?.message || error);
  }
};

const buildLeaderboardRows = async ({
  feedbacks,
  includeWindowInKey = false,
}) => {
  // shared leaderboard builder prevents duplication drift across endpoints.
  const deduped = dedupeFeedbacksForAggregation(feedbacks, {
    includeWindowInKey,
  });

  const toScore = (label) => ratingMap[label] ?? null;
  const groups = new Map();

  for (const fb of deduped) {
    const catererId = String(fb?.caterer?._id || fb?.caterer || "");
    if (!catererId) continue;

    if (!groups.has(catererId)) {
      groups.set(catererId, {
        catererId,
        catererName: fb?.caterer?.name || "Unknown",
        totalUsers: 0,
        smcUsers: 0,
        breakfastSum: 0,
        lunchSum: 0,
        dinnerSum: 0,
        smc: {
          hygieneSum: 0,
          wasteDisposalSum: 0,
          qualitySum: 0,
          uniformSum: 0,
          count: 0,
        },
      });
    }

    const g = groups.get(catererId);
    g.totalUsers += 1;
    if (fb.user?.isSMC) g.smcUsers += 1;

    g.breakfastSum += toScore(fb.breakfast) || 0;
    g.lunchSum += toScore(fb.lunch) || 0;
    g.dinnerSum += toScore(fb.dinner) || 0;

    if (fb.user?.isSMC && fb.smcFields) {
      g.smc.hygieneSum += toScore(fb.smcFields.hygiene) || 0;
      g.smc.wasteDisposalSum += toScore(fb.smcFields.wasteDisposal) || 0;
      g.smc.qualitySum += toScore(fb.smcFields.qualityOfIngredients) || 0;
      g.smc.uniformSum += toScore(fb.smcFields.uniformAndPunctuality) || 0;
      g.smc.count += 1;
    }
  }

  const subscriberCountByCaterer = await getSubscriberCountByCatererIds(
    Array.from(groups.keys()),
  );

  const rows = [];
  for (const [, g] of groups) {
    const subscriberCount =
      subscriberCountByCaterer.get(String(g.catererId)) || 0;
    const avgBreakfast = computeMealOpi({
      mealSum: g.breakfastSum,
      responseCount: g.totalUsers,
      subscriberCount,
    });
    const avgLunch = computeMealOpi({
      mealSum: g.lunchSum,
      responseCount: g.totalUsers,
      subscriberCount,
    });
    const avgDinner = computeMealOpi({
      mealSum: g.dinnerSum,
      responseCount: g.totalUsers,
      subscriberCount,
    });
    const avgHygiene = g.smc.count ? g.smc.hygieneSum / g.smc.count : null;
    const avgWasteDisposal = g.smc.count
      ? g.smc.wasteDisposalSum / g.smc.count
      : null;
    const avgQualityOfIngredients = g.smc.count
      ? g.smc.qualitySum / g.smc.count
      : null;
    const avgUniformAndPunctuality = g.smc.count
      ? g.smc.uniformSum / g.smc.count
      : null;

    const overall = computeOverallOpi({
      breakfastAvg: avgBreakfast,
      lunchAvg: avgLunch,
      dinnerAvg: avgDinner,
      uniformAvg: avgUniformAndPunctuality ?? 0,
      cleanlinessAvg: avgHygiene ?? 0,
      wasteAvg: avgWasteDisposal ?? 0,
      qualityAvg: avgQualityOfIngredients ?? 0,
    });

    rows.push({
      catererId: g.catererId,
      catererName: g.catererName,
      totalUsers: g.totalUsers,
      smcUsers: g.smcUsers,
      avgBreakfast,
      avgLunch,
      avgDinner,
      avgHygiene,
      avgWasteDisposal,
      avgQualityOfIngredients,
      avgUniformAndPunctuality,
      overall,
    });
  }

  rows.sort((a, b) => b.overall - a.overall);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
};

const getFeedbackUserKey = (fb) => {
  if (!fb?.user) return `anonymous:${String(fb?._id || "")}`;
  if (typeof fb.user === "object") {
    return String(fb.user._id || fb.user.id || "");
  }
  return String(fb.user);
};

// Keep latest response for each user (input should be date-desc sorted)
const dedupeByLatestUserFeedback = (feedbacks = []) => {
  const seen = new Set();
  const result = [];
  for (const fb of feedbacks) {
    const key = getFeedbackUserKey(fb);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(fb);
  }
  return result;
};

// Keep latest feedback for each logical user submission key.
// For all-time leaderboard, include window in key so same user across months is retained.
const dedupeFeedbacksForAggregation = (
  feedbacks = [],
  { includeWindowInKey = false } = {},
) => {
  const seen = new Set();
  const result = [];
  for (const fb of feedbacks) {
    const userKey = getFeedbackUserKey(fb);
    const catererKey = String(fb?.caterer?._id || fb?.caterer || "");
    const windowKey = includeWindowInKey
      ? String(fb?.feedbackWindowNumber || "")
      : "";
    const key = `${catererKey}:${windowKey}:${userKey}`;
    if (!catererKey || !userKey || seen.has(key)) continue;
    seen.add(key);
    result.push(fb);
  }
  return result;
};

const computeOverallOpi = ({
  breakfastAvg = 0,
  lunchAvg = 0,
  dinnerAvg = 0,
  uniformAvg = 0,
  cleanlinessAvg = 0,
  wasteAvg = 0,
  qualityAvg = 0,
}) => {
  return (
    (10 * breakfastAvg +
      10 * lunchAvg +
      10 * dinnerAvg +
      2 * uniformAvg +
      4 * cleanlinessAvg +
      1 * wasteAvg +
      3 * qualityAvg) /
    40
  );
};

const computeMealOpi = ({
  mealSum = 0,
  responseCount = 0,
  subscriberCount = 0,
}) => {
  const responses = Number(responseCount) || 0;
  const subscribers = Math.max(Number(subscriberCount) || 0, responses);
  if (subscribers <= 0) return 0;
  return (Number(mealSum) + 4 * (subscribers - responses)) / subscribers;
};

const getSubscriberCountByCatererIds = async (catererIds) => {
  if (!Array.isArray(catererIds) || catererIds.length === 0) {
    return new Map();
  }

  const uniqueCatererIds = [...new Set(catererIds.map((id) => String(id)))];

  const messes = await Mess.find(
    { _id: { $in: uniqueCatererIds } },
    { _id: 1, hostelId: 1 },
  ).lean();

  const hostelByCaterer = new Map();
  const hostelIds = [];
  for (const mess of messes) {
    if (!mess?.hostelId) continue;
    const catererId = String(mess._id);
    const hostelId = mess.hostelId;
    hostelByCaterer.set(catererId, hostelId);
    hostelIds.push(hostelId);
  }

  if (hostelIds.length === 0) {
    return new Map(uniqueCatererIds.map((id) => [id, 0]));
  }

  const subscriberRows = await UserAllocHostel.aggregate([
    // split subscribed vs fallback paths to better align with single-field indexes.
    {
      $facet: {
        subscribed: [
          { $match: { current_subscribed_mess: { $in: hostelIds } } },
          { $project: { subscribedHostel: "$current_subscribed_mess" } },
        ],
        fallback: [
          {
            $match: {
              current_subscribed_mess: null,
              hostel: { $in: hostelIds },
            },
          },
          { $project: { subscribedHostel: "$hostel" } },
        ],
      },
    },
    {
      $project: {
        merged: { $concatArrays: ["$subscribed", "$fallback"] },
      },
    },
    { $unwind: "$merged" },
    {
      $group: {
        _id: "$merged.subscribedHostel",
        count: { $sum: 1 },
      },
    },
  ]);

  const subscriberByHostel = new Map(
    subscriberRows.map((row) => [String(row._id), row.count]),
  );

  const subscriberByCaterer = new Map();
  for (const catererId of uniqueCatererIds) {
    const hostelId = hostelByCaterer.get(catererId);
    const count = hostelId ? subscriberByHostel.get(String(hostelId)) || 0 : 0;
    subscriberByCaterer.set(catererId, count);
  }

  return subscriberByCaterer;
};

// ==========================================
// Get feedback texts for a caterer (with user names) - paginated
// Auth: HAB/Admin
// ==========================================
export const getFeedbacksByCaterer = async (req, res) => {
  try {
    const {
      catererId,
      page = "1",
      pageSize = "10",
      windowNumber,
      showOnlySMC,
      hideEmptyMessages,
    } = req.query;
    if (!catererId) {
      return res.status(400).json({ message: "catererId is required" });
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10));

    const parsedWindow = parseWindowNumberStrict(windowNumber);
    if (!parsedWindow.ok) {
      return res.status(400).json({ message: parsedWindow.message });
    }

    const query = { caterer: catererId };
    if (parsedWindow.value !== null) {
      query.feedbackWindowNumber = parsedWindow.value;
    }

    let rawItems = await Feedback.find(query)
      // isSMC is needed for optional SMC-only filtering in this endpoint.
      .populate("user", "name isSMC")
      .sort({ date: -1 })
      .lean();

    if (showOnlySMC === "true") {
      rawItems = rawItems.filter((fb) => fb.user?.isSMC || fb.smcFields);
    }

    if (hideEmptyMessages === "true") {
      rawItems = rawItems.filter(
        (fb) => fb.comment && fb.comment.trim() !== "",
      );
    }

    const dedupedItems = dedupeByLatestUserFeedback(rawItems);
    const total = dedupedItems.length;
    const items = dedupedItems.slice((p - 1) * size, p * size);

    const mapped = items.map((fb) => ({
      id: String(fb._id),
      userName: fb.user?.name || "Anonymous User",
      message: fb.comment || "",
      createdAt: fb.date,
      breakfast: fb.breakfast,
      lunch: fb.lunch,
      dinner: fb.dinner,
      smcFields: fb.smcFields,
    }));

    // Compute OPI and Rank context for this caterer (window-scoped if provided, otherwise all-time)
    let opi = null;
    let rank = null;
    try {
      const fbQuery = { caterer: { $ne: null } };
      if (parsedWindow.value !== null) {
        fbQuery.feedbackWindowNumber = parsedWindow.value;
      }

      const allRaw = await Feedback.find(fbQuery)
        .populate("user", "isSMC")
        .populate("caterer", "name")
        .sort({ date: -1 })
        .lean();
      const rows = await buildLeaderboardRows({
        feedbacks: allRaw,
        includeWindowInKey: parsedWindow.value === null,
      });
      const row = rows.find((r) => r.catererId === String(catererId));
      if (row) {
        opi = row.overall;
        rank = row.rank;
      }
    } catch (e) {
      // If leaderboard calc fails, keep opi/rank null but do not fail the endpoint
      console.error(
        "[FEEDBACK] getFeedbacksByCaterer leaderboard calc error:",
        e,
      );
    }

    return res.status(200).json({
      items: mapped,
      page: p,
      pageSize: size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
      opi,
      rank,
    });
  } catch (e) {
    console.error("[FEEDBACK] getFeedbacksByCaterer error:", e);
    return res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
};

// ==========================================
// Detailed feedback rows for a specific window (HAB/Admin)
// Query params: windowNumber (required)
// Response: [{ userName, rollNumber, breakfast, lunch, dinner, smcFields, comment, catererName, date }]
// ==========================================
export const getDetailedFeedbackByWindow = async (req, res) => {
  try {
    const { windowNumber } = req.query;
    const parsedWindow = parseWindowNumberStrict(windowNumber, {
      required: true,
    });
    if (!parsedWindow.ok) {
      return res.status(400).json({ message: parsedWindow.message });
    }

    const feedbacks = await Feedback.find({
      caterer: { $ne: null },
      feedbackWindowNumber: parsedWindow.value,
    })
      .populate("user", "name rollNumber isSMC")
      .populate({
        path: "caterer",
        select: "name hostelId",
        populate: { path: "hostelId", select: "hostel_name" },
      })
      .sort({ date: -1 })
      .lean();

    const dedupedFeedbacks = dedupeByLatestUserFeedback(feedbacks);
    const rows = dedupedFeedbacks.map((fb) => {
      const isSMC = !!fb.user?.isSMC;
      return {
        userName: fb.user?.name || "Anonymous User",
        rollNumber: fb.user?.rollNumber || "-",
        breakfast: fb.breakfast || "-",
        lunch: fb.lunch || "-",
        dinner: fb.dinner || "-",
        smcFields: isSMC
          ? {
              cleanliness: fb.smcFields?.hygiene || "-",
              wasteDisposal: fb.smcFields?.wasteDisposal || "-",
              qualityOfIngredients: fb.smcFields?.qualityOfIngredients || "-",
              uniformAndPunctuality: fb.smcFields?.uniformAndPunctuality || "-",
            }
          : null,
        comment: fb.comment || "",
        catererName: fb.caterer?.name || "-",
        hostelName: fb.caterer?.hostelId?.hostel_name || "-",
        isSMC,
        date: fb.date,
      };
    });

    return res.status(200).json(rows);
  } catch (e) {
    console.error("[FEEDBACK] getDetailedFeedbackByWindow error:", e);
    return res.status(500).json({
      message: "Failed to fetch detailed feedback by window",
      error: String(e.message || e),
    });
  }
};

// ==========================================
// Submit feedback
// ==========================================
export const submitFeedback = async (req, res) => {
  try {
    const { name, rollNumber, breakfast, lunch, dinner, comment, smcFields } =
      req.body;
    if (!name || !rollNumber || !breakfast || !lunch || !dinner) {
      return res.status(400).send("Incomplete feedback data");
    }

    // Enforce feedback window
    let settings = await FeedbackSettings.findOne();
    if (!settings || !settings.isEnabled) {
      return res.status(403).send("Mess feedback is currently closed by HAB.");
    }

    // Enforce feedback window closing time
    if (settings.currentWindowClosingTime) {
      const expiresAt = new Date(settings.currentWindowClosingTime);
      if (new Date() > expiresAt) {
        return res.status(403).send("Mess feedback window has ended.");
      }
    }

    // Find by roll number first, then enforce roll-name consistency.
    const user = await User.findOne({ rollNumber });
    if (!user) return res.status(404).send("User not found");
    if (user.name !== name) {
      return res.status(400).send("Name does not match the provided roll number");
    }

    // Prepare feedback data
    const feedbackData = {
      user: user._id,
      breakfast,
      lunch,
      dinner,
      comment,
      date: new Date(),
      feedbackWindowNumber: settings.currentWindowNumber,
    };

    // Resolve caterer (mess) ID from user's subscribed mess (hostel)
    let catererId = null;
    if (user.curr_subscribed_mess) {
      const hostelDoc = await Hostel.findById(user.curr_subscribed_mess).lean();
      catererId = hostelDoc?.messId || null;
    }
    feedbackData.caterer = catererId;

    // Include SMC fields only for SMC members
    if (user.isSMC) {
      if (!smcFields) {
        return res
          .status(400)
          .send("SMC users must provide extra feedback fields");
      }
      feedbackData.smcFields = smcFields;
    }

    const existingFeedback = await Feedback.findOne({
      user: user._id,
      feedbackWindowNumber: settings.currentWindowNumber,
    }).lean();
    // DB truth check prevents stale-flag duplicates across concurrent submissions.
    if (existingFeedback) {
      if (!user.isFeedbackSubmitted) {
        user.isFeedbackSubmitted = true;
        await user.save();
      }
      return res.status(400).send("Feedback already submitted for this window");
    }

    const feedback = new Feedback(feedbackData);
    await feedback.save();

    // Mark feedback as submitted for this window
    user.isFeedbackSubmitted = true;
    await user.save();

    await invalidateFeedbackCaches({
      windowNumber: settings.currentWindowNumber,
    });

    res.status(200).send("Feedback submitted successfully");
  } catch (err) {
    // unique index race collision should be reported as duplicate submit, not 500.
    if (err?.code === 11000) {
      return res.status(400).send("Feedback already submitted for this window");
    }
    console.error(err);
    res.status(500).send("Error saving feedback");
  }
};

// ==========================================
// Remove feedback
// ==========================================
export const removeFeedback = async (req, res) => {
  try {
    const { name, rollNumber } = req.body;
    if (!name || !rollNumber) {
      return res.status(400).send("Name and Roll Number required");
    }

    const user = await User.findOne({ name, rollNumber });
    if (!user) return res.status(404).send("User not found");

    // Get current window number
    const settings = await FeedbackSettings.findOne();
    const currentWindowNumber = settings?.currentWindowNumber || 1;

    const deleteResult = await Feedback.deleteOne({
      user: user._id,
      feedbackWindowNumber: currentWindowNumber,
    });

    // only flip user flag if a row was actually removed.
    if (!deleteResult?.deletedCount) {
      return res.status(400).send("No feedback submitted by this user");
    }

    user.isFeedbackSubmitted = false;
    await user.save();

    await invalidateFeedbackCaches({ windowNumber: currentWindowNumber });

    res.status(200).send("Feedback removed successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing feedback");
  }
};

// ==========================================
// Get all feedbacks
// ==========================================
export const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate("user", "name rollNumber isSMC")
      .populate("caterer", "name")
      .sort({ date: -1 })
      .lean();

    const formatted = feedbacks.map((fb) => ({
      user: fb.user || null,
      caterer: fb.caterer || null,
      breakfast: fb.breakfast,
      lunch: fb.lunch,
      dinner: fb.dinner,
      comment: fb.comment,
      smcFields: fb.user?.isSMC ? fb.smcFields : undefined,
      date: fb.date,
    }));

    return res.status(200).json(formatted);
  } catch (err) {
    console.error("[FEEDBACK] getAllFeedback error:", err);
    return res.status(500).json({
      message: "Error fetching feedbacks",
      error: String(err?.message || err),
    });
  }
};

// ==========================================
// Enable / Disable Feedback Window
// ==========================================
// Helper to enable feedback automatically so schedulers can call it
export const enableFeedbackAutomatic = async (endDate = null) => {
  try {
    let savedSettings;

    // ATOMIC TRANSACTION
    await withTransaction(async (session) => {
      let s = await FeedbackSettings.findOne().session(session);
      if (!s) {
        s = new FeedbackSettings();
        s.currentWindowNumber = 1;
      }

      if (!s.isEnabled) {
        s.currentWindowNumber += 1;
        // Reset submission flag for every user in the same transaction
        await User.updateMany(
          {},
          { $set: { isFeedbackSubmitted: false } },
          { session },
        );
      }

      s.isEnabled = true;
      s.enabledAt = new Date();
      s.disabledAt = null;
      s.currentWindowClosingTime = endDate;
      await s.save({ session });
      savedSettings = s;
    });

    sendNotificationMessage(
      "MESS FEEDBACK",
      "Mess Feedback for this month is enabled",
      "All_Hostels",
      { redirectType: "mess_screen", isAlert: "true" },
    ).catch((err) =>
      console.error("[FEEDBACK] Window enabled notification failed:", err),
    );

    await invalidateFeedbackCaches({
      windowNumber: savedSettings?.currentWindowNumber,
    });
    console.log("[FEEDBACK] Window enabled automatically");
    return { success: true, settings: savedSettings };
  } catch (e) {
    console.error("[FEEDBACK] Error enabling automatically:", e);
    return { success: false, error: e };
  }
};

// Generate Mess OPI Report
export const buildOpiReportData = async (windowNumber) => {
  const rawFeedbacks = await Feedback.find({
    feedbackWindowNumber: windowNumber,
    caterer: { $ne: null },
  })
    .populate("user", "name rollNumber isSMC")
    .populate({
      path: "caterer",
      select: "name hostelId",
      populate: { path: "hostelId", select: "hostel_name" },
    })
    .sort({ date: -1 })
    .lean();

  const seen = new Set();
  const feedbacks = [];
  for (const fb of rawFeedbacks) {
    const key = String(fb.user?._id || fb._id);
    if (seen.has(key)) continue;
    seen.add(key);
    feedbacks.push({ ...fb, catererName: fb.caterer?.name || "" });
  }

  // Fetch all allocations
  const allAllocs = await UserAllocHostel.find({})
    .populate("hostel", "hostel_name")
    .populate("current_subscribed_mess", "hostel_name")
    .lean();

  // Cross-reference with users collection to determine app installation
  const allRollNos = allAllocs.map((a) => a.rollno).filter(Boolean);
  const appUsers = await User.find({
    rollNumber: { $in: allRollNos },
    authProvider: { $ne: "guest" },
  })
    .select("rollNumber name")
    .lean();

  const appRollSet = new Set();
  const appNameMap = new Map();
  for (const u of appUsers) {
    appRollSet.add(String(u.rollNumber));
    appNameMap.set(String(u.rollNumber), u.name || null);
  }

  const mapAlloc = (alloc, hasApp) => ({
    rollno: alloc.rollno,
    name: hasApp ? appNameMap.get(String(alloc.rollno)) || null : null,
    hasApp,
    hostelName: alloc.hostel?.hostel_name || String(alloc.hostel || ""),
    subscribedMessName:
      alloc.current_subscribed_mess?.hostel_name ||
      alloc.hostel?.hostel_name ||
      "",
    messChanged:
      String(
        alloc.current_subscribed_mess?._id ||
          alloc.current_subscribed_mess ||
          "",
      ) !== String(alloc.hostel?._id || alloc.hostel || ""),
  });

  const subscribers = allAllocs.map((a) =>
    mapAlloc(a, appRollSet.has(String(a.rollno))),
  );

  const allMesses = await Mess.find({})
    .populate("hostelId", "hostel_name")
    .lean();
  const messes = allMesses
    .filter((m) => m.hostelId)
    .map((m) => ({
      name: m.name,
      hostelName: m.hostelId.hostel_name,
      hostelId: m.hostelId._id,
    }))
    .sort((a, b) => a.hostelName.localeCompare(b.hostelName));

  return { feedbacks, subscribers, messes };
};

// Helper to disable feedback automatically
export const disableFeedbackAutomatic = async () => {
  try {
    let windowNumber;

    // ATOMIC TRANSACTION
    await withTransaction(async (session) => {
      const s = await FeedbackSettings.findOne().session(session);
      if (!s) throw new Error("FeedbackSettings not found");

      windowNumber = s.currentWindowNumber;
      s.isEnabled = false;
      s.disabledAt = new Date();
      await s.save({ session });
    });

    // Recalculate all mess OPI ratings and rankings
    if (typeof windowNumber === "number") {
      await updateAllMessRatingsAndRankings(windowNumber).catch((err) =>
        console.error("[OPI] Rankings update failed:", err),
      );
    }

    // Generate OPI Excel Report
    console.log(`[OPI] Generating OPI report for window ${windowNumber}`);
    try {
      const { feedbacks, subscribers, messes } =
        await buildOpiReportData(windowNumber);

      const now = new Date();
      const monthName = now.toLocaleString("en-IN", {
        month: "long",
        timeZone: "Asia/Kolkata",
      });
      const year = now.getFullYear();
      const windowLabel = `${monthName} ${year}`;

      const reportBuffer = await generateOpiReport({
        windowNumber,
        windowLabel,
        feedbacks,
        subscribers,
        messes,
      });

      const reportFilename = `OPI_Report_Window${windowNumber}_${Date.now()}.xlsx`;

      // Save copy to backup
      await saveOpiReportBackup(reportBuffer, reportFilename);

      // Upload to OneDrive Reports folder
      const url = await uploadReportToOnedrive(reportBuffer, reportFilename);
      if (url) {
        console.log(`[OPI] Report uploaded to OneDrive: ${url}`);
      } else {
        console.warn("[OPI] OneDrive upload skipped or failed");
      }
    } catch (reportErr) {
      // Report generation failure must not abort the disable flow
      console.error("[OPI] Failed to generate/upload OPI report:", reportErr);
    }

    console.log("[FEEDBACK] Window disabled automatically");
    await invalidateFeedbackCaches({ windowNumber });
    return { success: true };
  } catch (e) {
    console.error("[FEEDBACK] Error disabling automatically:", e);
    return { success: false, error: e };
  }
};

// ==========================================
// Get feedback settings
// ==========================================
export const getFeedbackSettings = async (req, res) => {
  try {
    const cachedSettings = await getCachedJson(
      CACHE_KEYS.settings,
      CACHE_TTL_SECONDS.settings,
    );
    // hot path for repeated settings polling from mobile/HAB clients.
    if (cachedSettings) return res.status(200).json(cachedSettings);

    let s = await FeedbackSettings.findOne();
    // Check if window has expired and report accordingly, but don't
    // persist the disable - let the scheduler handle it so
    // updateAllMessRatingsAndRankings is properly called.
    let responseData;
    if (s?.isEnabled && s.currentWindowClosingTime) {
      const expiresAt = new Date(s.currentWindowClosingTime);
      if (new Date() > expiresAt) {
        // Return as disabled to the client without persisting
        responseData = s.toObject();
        responseData.isEnabled = false;
      }
    }

    if (!responseData) {
      responseData = s || {
        isEnabled: false,
        enabledAt: null,
        disabledAt: null,
        currentWindowNumber: 1,
      };
    }

    await setCachedJson(
      CACHE_KEYS.settings,
      responseData,
      CACHE_TTL_SECONDS.settings,
    );
    return res.status(200).json(responseData);
  } catch (e) {
    return res.status(500).json({
      message: "Failed to fetch settings",
      error: String(e.message || e),
    });
  }
};

// ==========================================
// Get feedback settings (Public - for mobile app)
// ==========================================
export const getFeedbackSettingsPublic = async (req, res) => {
  try {
    const cachedSettings = await getCachedJson(
      CACHE_KEYS.settings,
      CACHE_TTL_SECONDS.settings,
    );
    // same cache strategy for public settings endpoint.
    if (cachedSettings) return res.status(200).json(cachedSettings);

    let s = await FeedbackSettings.findOne();
    // Same as getFeedbackSettings: report expired state without persisting
    let responseData;
    if (s?.isEnabled && s.currentWindowClosingTime) {
      const expiresAt = new Date(s.currentWindowClosingTime);
      if (new Date() > expiresAt) {
        responseData = s.toObject();
        responseData.isEnabled = false;
      }
    }

    if (!responseData) {
      responseData = s || {
        isEnabled: false,
        enabledAt: null,
        disabledAt: null,
        currentWindowNumber: 1,
      };
    }

    await setCachedJson(
      CACHE_KEYS.settings,
      responseData,
      CACHE_TTL_SECONDS.settings,
    );
    return res.status(200).json(responseData);
  } catch (e) {
    return res.status(500).json({
      message: "Failed to fetch settings",
      error: String(e.message || e),
    });
  }
};

// ==========================================
// Get feedback schedule info (HAB)
// ==========================================
export const getFeedbackScheduleInfo = async (req, res) => {
  try {
    const settings = await FeedbackSettings.findOne();

    const now = new Date();
    let month = now.getMonth();
    let year = now.getFullYear();

    let { startDate, endDate, startDay, endDay } = getFeedbackWindowDates(
      month,
      year,
    );

    // If we've already passed this month's window, show next month's window
    if (now > endDate) {
      if (month === 11) {
        month = 0;
        year += 1;
      } else {
        month += 1;
      }
      ({ startDate, endDate, startDay, endDay } = getFeedbackWindowDates(
        month,
        year,
      ));
    }

    return res.status(200).json({
      message: "Feedback schedule information",
      data: {
        currentSettings: settings,
        schedule: {
          enablePattern: `${getOrdinalSuffix(startDay)}-${getOrdinalSuffix(endDay)} at 9:00 AM IST`,
          disablePattern: `End of day on ${getOrdinalSuffix(endDay)} IST`,
          nextEnableDate: startDate.toISOString(),
          nextDisableDate: endDate.toISOString(),
          nextEnableDateIST: startDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
          nextDisableDateIST: endDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
        },
        currentTimeIST: new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
      },
    });
  } catch (error) {
    console.error("[FEEDBACK] Error fetching schedule info:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ==========================================
// Leaderboard (All-time)
// ==========================================
export const getFeedbackLeaderboard = async (req, res) => {
  try {
    const cachedRows = await getCachedJson(
      CACHE_KEYS.allTimeLeaderboard,
      CACHE_TTL_SECONDS.leaderboard,
    );
    // all-time leaderboard is expensive and frequently queried.
    if (cachedRows) {
      return res.status(200).json(cachedRows);
    }

    const feedbacksRaw = await Feedback.find({ caterer: { $ne: null } })
      .populate("user", "isSMC")
      .populate("caterer", "name")
      .sort({ date: -1 })
      .lean();

    const rows = await buildLeaderboardRows({
      feedbacks: feedbacksRaw,
      includeWindowInKey: true,
    });

    await setCachedJson(
      CACHE_KEYS.allTimeLeaderboard,
      rows,
      CACHE_TTL_SECONDS.leaderboard,
    );

    return res.status(200).json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Failed to build leaderboard",
      error: String(e.message || e),
    });
  }
};

// ==========================================
// Available feedback windows
// ==========================================
export const getAvailableWindows = async (req, res) => {
  try {
    const cachedWindows = await getCachedJson(
      CACHE_KEYS.windows,
      CACHE_TTL_SECONDS.windows,
    );
    // distinct windows change rarely; cache cuts DB overhead.
    if (cachedWindows) {
      return res.status(200).json(cachedWindows);
    }

    const windows = await Feedback.distinct("feedbackWindowNumber");
    const sorted = windows
      .filter((window) => Number.isInteger(window) && window > 0)
      .sort((a, b) => b - a);

    await setCachedJson(CACHE_KEYS.windows, sorted, CACHE_TTL_SECONDS.windows);

    return res.status(200).json(sorted);
  } catch (e) {
    console.error("getAvailableWindows error:", e);
    return res.status(500).json({ message: "Failed to fetch windows" });
  }
};

// ==========================================
// Window-based leaderboard
// ==========================================
export const getFeedbackLeaderboardByWindow = async (req, res) => {
  try {
    const { windowNumber } = req.query;
    const parsedWindow = parseWindowNumberStrict(windowNumber, {
      required: true,
    });
    if (!parsedWindow.ok) {
      return res.status(400).json({ message: parsedWindow.message });
    }

    const leaderboardCacheKey = CACHE_KEYS.windowLeaderboard(parsedWindow.value);
    const cachedRows = await getCachedJson(
      leaderboardCacheKey,
      CACHE_TTL_SECONDS.leaderboard,
    );
    // first try fast cache for closed/open windows alike.
    if (cachedRows) {
      return res.status(200).json(cachedRows);
    }

    const persistedSnapshot = await FeedbackWindowStats.find({
      windowNumber: parsedWindow.value,
    })
      .sort({ rank: 1, overall: -1 })
      .lean();

    // closed-window snapshot avoids recomputation for historical reads.
    if (persistedSnapshot.length > 0) {
      const snapshotRows = persistedSnapshot.map((row) => ({
        catererId: String(row.caterer),
        catererName: row.catererName,
        totalUsers: row.totalUsers,
        smcUsers: row.smcUsers,
        avgBreakfast: row.avgBreakfast,
        avgLunch: row.avgLunch,
        avgDinner: row.avgDinner,
        avgHygiene: row.avgHygiene,
        avgWasteDisposal: row.avgWasteDisposal,
        avgQualityOfIngredients: row.avgQualityOfIngredients,
        avgUniformAndPunctuality: row.avgUniformAndPunctuality,
        overall: row.overall,
        rank: row.rank,
      }));

      await setCachedJson(
        leaderboardCacheKey,
        snapshotRows,
        CACHE_TTL_SECONDS.leaderboard,
      );
      return res.status(200).json(snapshotRows);
    }

    const feedbacksRaw = await Feedback.find({
      caterer: { $ne: null },
      feedbackWindowNumber: parsedWindow.value,
    })
      .populate("user", "isSMC")
      .populate("caterer", "name")
      .sort({ date: -1 })
      .lean();

    const rows = await buildLeaderboardRows({ feedbacks: feedbacksRaw });

    await setCachedJson(
      leaderboardCacheKey,
      rows,
      CACHE_TTL_SECONDS.leaderboard,
    );

    return res.status(200).json(rows);
  } catch (e) {
    console.error("getFeedbackLeaderboardByWindow error:", e);
    return res.status(500).json({
      message: "Failed to fetch window-based leaderboard",
      error: String(e.message || e),
    });
  }
};

// ==========================================
// Check if feedback is already submitted for this window
// ==========================================
export const checkFeedbackSubmitted = async (req, res) => {
  try {
    const user = req.user; // set by authenticateJWT
    if (!user)
      return res
        .status(401)
        .json({ submitted: false, message: "User not authenticated" });

    const settings = await FeedbackSettings.findOne({}, { currentWindowNumber: 1 })
      .lean();
    const currentWindowNumber = settings?.currentWindowNumber || 1;

    const feedbackExists = await Feedback.exists({
      user: user._id,
      feedbackWindowNumber: currentWindowNumber,
    });
    // use DB truth for current window instead of relying on potentially stale JWT/user flag.

    if (Boolean(feedbackExists) && !user.isFeedbackSubmitted) {
      await User.updateOne(
        { _id: user._id },
        { $set: { isFeedbackSubmitted: true } },
      );
    }

    if (!feedbackExists && user.isFeedbackSubmitted) {
      await User.updateOne(
        { _id: user._id },
        { $set: { isFeedbackSubmitted: false } },
      );
    }

    return res.status(200).json({ submitted: Boolean(feedbackExists) });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ submitted: false, message: "Error checking feedback status" });
  }
};

// ==========================================
// Get feedback window closing time and time left
// ==========================================
export const getFeedbackWindowTimeLeft = async (req, res) => {
  try {
    let s = await FeedbackSettings.findOne();
    if (!s || !s.isEnabled || !s.currentWindowClosingTime) {
      return res.status(404).json({ message: "No active feedback window" });
    }
    const now = new Date();
    const closing = new Date(s.currentWindowClosingTime);
    let diffMs = closing - now;
    if (diffMs <= 0) {
      return res
        .status(200)
        .json({ timeLeft: 0, unit: "minutes", formatted: "Closed" });
    }
    const totalMinutes = Math.floor(diffMs / 60000);
    const totalHours = Math.floor(diffMs / (60 * 60000));
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
      (diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

    let formatted = "";
    let unit = "minutes";
    if (days >= 1) {
      formatted =
        hours > 0
          ? `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`
          : `${days} day${days > 1 ? "s" : ""}`;
      unit = "days";
    } else if (totalHours >= 1) {
      formatted =
        minutes > 0
          ? `${totalHours} hour${totalHours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`
          : `${totalHours} hour${totalHours !== 1 ? "s" : ""}`;
      unit = "hours";
    } else {
      formatted = `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""}`;
      unit = "minutes";
    }
    return res.status(200).json({ timeLeft: diffMs, unit, formatted });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to fetch window time left",
      error: String(e.message || e),
    });
  }
};

// ---------------------------------------------------------------------------
// Update Mess OPI
// ---------------------------------------------------------------------------
export const updateAllMessRatingsAndRankings = async (windowNumber) => {
  if (typeof windowNumber !== "number") return;

  const startTime = Date.now();
  console.log(
    `[OPI] Starting mess ratings update for window ${windowNumber}...`,
  );

  // Get all messes and hostels
  const messes = await Mess.find({}, { _id: 1, hostelId: 1, name: 1 }).lean();
  if (!messes.length) return;

  const hostels = await Hostel.find({}, { _id: 1, messId: 1 }).lean();
  const hostelByMess = new Map();
  for (const hostel of hostels) {
    if (hostel.messId) hostelByMess.set(String(hostel.messId), hostel._id);
  }

  // Get subscriber counts per hostel
  const relevantHostelIds = Array.from(hostelByMess.values());
  const subscriberRows = await UserAllocHostel.aggregate([
    {
      $match: {
        $or: [
          { current_subscribed_mess: { $in: relevantHostelIds } },
          { hostel: { $in: relevantHostelIds } },
        ],
      },
    },
    {
      $project: {
        subscribedHostel: {
          $ifNull: ["$current_subscribed_mess", "$hostel"],
        },
      },
    },
    { $group: { _id: "$subscribedHostel", count: { $sum: 1 } } },
  ]);
  const subscriberByHostel = new Map(
    subscriberRows.map((row) => [String(row._id), row.count]),
  );

  // Aggregate feedbacks server-side
  const ratingSwitch = (field) => ({
    $switch: {
      branches: [
        { case: { $eq: [field, "Very Poor"] }, then: 1 },
        { case: { $eq: [field, "Poor"] }, then: 2 },
        { case: { $eq: [field, "Average"] }, then: 3 },
        { case: { $eq: [field, "Good"] }, then: 4 },
        { case: { $eq: [field, "Very Good"] }, then: 5 },
      ],
      default: 0,
    },
  });

  const feedbackAgg = await Feedback.aggregate([
    {
      $match: {
        feedbackWindowNumber: windowNumber,
        caterer: { $ne: null },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        pipeline: [{ $project: { isSMC: 1 } }],
        as: "userData",
      },
    },
    { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
    {
      $addFields: { isSMC: { $ifNull: ["$userData.isSMC", false] } },
    },
    {
      $group: {
        _id: "$caterer",
        totalUsers: { $sum: 1 },
        breakfastSum: { $sum: ratingSwitch("$breakfast") },
        lunchSum: { $sum: ratingSwitch("$lunch") },
        dinnerSum: { $sum: ratingSwitch("$dinner") },
        hygieneSum: {
          $sum: {
            $cond: ["$isSMC", ratingSwitch("$smcFields.hygiene"), 0],
          },
        },
        wasteDisposalSum: {
          $sum: {
            $cond: ["$isSMC", ratingSwitch("$smcFields.wasteDisposal"), 0],
          },
        },
        qualitySum: {
          $sum: {
            $cond: [
              "$isSMC",
              ratingSwitch("$smcFields.qualityOfIngredients"),
              0,
            ],
          },
        },
        uniformSum: {
          $sum: {
            $cond: [
              "$isSMC",
              ratingSwitch("$smcFields.uniformAndPunctuality"),
              0,
            ],
          },
        },
        smcCount: { $sum: { $cond: ["$isSMC", 1, 0] } },
      },
    },
  ]);

  // Build lookup from aggregation results
  const aggByMess = new Map();
  for (const row of feedbackAgg) aggByMess.set(String(row._id), row);

  // Compute OPI for all messes (including zero-feedback ones)
  const rows = [];
  for (const mess of messes) {
    const messId = String(mess._id);
    const agg = aggByMess.get(messId) || {
      totalUsers: 0,
      breakfastSum: 0,
      lunchSum: 0,
      dinnerSum: 0,
      hygieneSum: 0,
      wasteDisposalSum: 0,
      qualitySum: 0,
      uniformSum: 0,
      smcCount: 0,
    };

    const hostelId = hostelByMess.get(messId);
    const subscriberCount = hostelId
      ? subscriberByHostel.get(String(hostelId)) || 0
      : 0;

    const avgBreakfast = computeMealOpi({
      mealSum: agg.breakfastSum,
      responseCount: agg.totalUsers,
      subscriberCount,
    });
    const avgLunch = computeMealOpi({
      mealSum: agg.lunchSum,
      responseCount: agg.totalUsers,
      subscriberCount,
    });
    const avgDinner = computeMealOpi({
      mealSum: agg.dinnerSum,
      responseCount: agg.totalUsers,
      subscriberCount,
    });
    const avgHygiene = agg.smcCount ? agg.hygieneSum / agg.smcCount : null;
    const avgWasteDisposal = agg.smcCount
      ? agg.wasteDisposalSum / agg.smcCount
      : null;
    const avgQualityOfIngredients = agg.smcCount
      ? agg.qualitySum / agg.smcCount
      : null;
    const avgUniformAndPunctuality = agg.smcCount
      ? agg.uniformSum / agg.smcCount
      : null;

    let overall = computeOverallOpi({
      breakfastAvg: avgBreakfast,
      lunchAvg: avgLunch,
      dinnerAvg: avgDinner,
      uniformAvg: avgUniformAndPunctuality ?? 0,
      cleanlinessAvg: avgHygiene ?? 0,
      wasteAvg: avgWasteDisposal ?? 0,
      qualityAvg: avgQualityOfIngredients ?? 0,
    });
    // Round to two decimal places before storing
    overall = Math.round(overall * 100) / 100;

    rows.push({
      messId,
      catererName: mess.name || "Unknown",
      totalUsers: agg.totalUsers,
      smcUsers: agg.smcCount,
      avgBreakfast,
      avgLunch,
      avgDinner,
      avgHygiene,
      avgWasteDisposal,
      avgQualityOfIngredients,
      avgUniformAndPunctuality,
      overall,
    });
  }

  rows.sort((a, b) => b.overall - a.overall);
  rows.forEach((r, i) => (r.rank = i + 1));

  // Single bulk write
  if (rows.length > 0) {
    const bulkOps = rows.map((r) => ({
      updateOne: {
        filter: { _id: r.messId },
        update: { $set: { rating: r.overall, ranking: r.rank } },
      },
    }));
    await Mess.bulkWrite(bulkOps);

    const snapshotAt = new Date();
    // persist per-window leaderboard snapshot rows for cheap read-path later.
    const snapshotOps = rows.map((r) => ({
      updateOne: {
        filter: {
          windowNumber,
          caterer: r.messId,
        },
        update: {
          $set: {
            windowNumber,
            caterer: r.messId,
            catererName: r.catererName,
            totalUsers: r.totalUsers,
            smcUsers: r.smcUsers,
            avgBreakfast: r.avgBreakfast,
            avgLunch: r.avgLunch,
            avgDinner: r.avgDinner,
            avgHygiene: r.avgHygiene,
            avgWasteDisposal: r.avgWasteDisposal,
            avgQualityOfIngredients: r.avgQualityOfIngredients,
            avgUniformAndPunctuality: r.avgUniformAndPunctuality,
            overall: r.overall,
            rank: r.rank,
            snapshotAt,
          },
        },
        upsert: true,
      },
    }));
    await FeedbackWindowStats.bulkWrite(snapshotOps);
  }

  await invalidateFeedbackCaches({ windowNumber });

  console.log(
    `[OPI] Mess ratings updated for ${rows.length} messes in ${Date.now() - startTime}ms`,
  );
};
