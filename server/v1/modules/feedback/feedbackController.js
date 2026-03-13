const { User } = require("../user/userModel");
const { Hostel } = require("../hostel/hostelModel");
const { Mess } = require("../mess/messModel");
const UserAllocHostel = require("../hostel/hostelAllocModel");
const Feedback = require("./feedbackModel");
const { FeedbackSettings } = require("./feedbackSettingsModel");
const { FeedbackWindowStats } = require("./feedbackWindowStatsModel");
const {
  sendNotificationMessage,
} = require("../notification/notificationController");
const redisClient = require("../../utils/redisClient.js");

const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const leaderboardCache = new Map();
const LEADERBOARD_ALL_KEY = "leaderboard:all";

const getCachedValue = (key) => {
  const entry = leaderboardCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    leaderboardCache.delete(key);
    return null;
  }
  return entry.value;
};

const setCachedValue = (key, value, ttlMs = LEADERBOARD_CACHE_TTL_MS) => {
  leaderboardCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const getCachedLeaderboardRows = async (key) => {
  const inMemory = getCachedValue(key);
  if (inMemory) return inMemory;

  const redisValue = await redisClient.get(key);
  if (!redisValue) return null;

  try {
    const parsed = JSON.parse(redisValue);
    setCachedValue(key, parsed);
    return parsed;
  } catch (_) {
    return null;
  }
};

const setCachedLeaderboardRows = async (
  key,
  rows,
  ttlMs = LEADERBOARD_CACHE_TTL_MS,
) => {
  setCachedValue(key, rows, ttlMs);
  await redisClient.set(
    key,
    JSON.stringify(rows),
    "EX",
    Math.ceil(ttlMs / 1000),
  );
};

const invalidateLeaderboardCache = async (windowNumber = null) => {
  leaderboardCache.clear();
  await redisClient.del(LEADERBOARD_ALL_KEY);
  if (typeof windowNumber === "number") {
    await redisClient.del(`leaderboard:${windowNumber}`);
  }
};

const parseOptionalInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const ratingMap = {
  "Very Poor": 1,
  Poor: 2,
  Average: 3,
  Good: 4,
  "Very Good": 5,
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
    {
      $match: {
        $or: [
          { current_subscribed_mess: { $in: hostelIds } },
          { hostel: { $in: hostelIds } },
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
    {
      $group: {
        _id: "$subscribedHostel",
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

const buildLeaderboardRowsFromFeedbacks = async (feedbacks) => {
  const toScore = (label) => ratingMap[label] ?? null;
  const groups = new Map();

  for (const fb of feedbacks) {
    if (!fb?.caterer?._id) continue;
    const key = String(fb.caterer._id);
    if (!groups.has(key)) {
      groups.set(key, {
        catererId: key,
        catererName: fb.caterer.name,
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

    const g = groups.get(key);
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
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
};

const getWindowLeaderboardSnapshot = async (windowNumber) => {
  if (typeof windowNumber !== "number") return null;
  const doc = await FeedbackWindowStats.findOne(
    { windowNumber },
    { _id: 0, rows: 1, computedAt: 1 },
  ).lean();
  return doc || null;
};

// ==========================================
// Get feedback texts for a caterer (with user names) - paginated
// Query params: catererId (required), page (default 1), pageSize (default 10), windowNumber (optional)
// Auth: HAB/Admin
// Response: { items: [{ id, userName, message, createdAt }], page, pageSize, total, totalPages }
// ==========================================
const getFeedbacksByCaterer = async (req, res) => {
  try {
    const { catererId, page = "1", pageSize = "10", windowNumber } = req.query;
    if (!catererId) {
      return res.status(400).json({ message: "catererId is required" });
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10));

    const parsedWindowNumber = parseOptionalInt(windowNumber);
    if (windowNumber && parsedWindowNumber === null) {
      return res.status(400).json({ message: "windowNumber must be a number" });
    }

    const query = { caterer: catererId };
    if (parsedWindowNumber !== null) {
      query.feedbackWindowNumber = parsedWindowNumber;
    }

    const [total, items] = await Promise.all([
      Feedback.countDocuments(query),
      Feedback.find(query)
        .populate("user", "name")
        .sort({ date: -1 })
        .skip((p - 1) * size)
        .limit(size)
        .lean(),
    ]);

    const mapped = items.map((fb) => ({
      id: String(fb._id),
      userName: fb.user?.name || "Anonymous User",
      message: fb.comment || "",
      createdAt: fb.date,
    }));

    // Compute OPI and Rank context for this caterer (window-scoped if provided, otherwise all-time)
    let opi = null;
    let rank = null;
    try {
      let rows = null;
      if (parsedWindowNumber) {
        const snapshot = await getWindowLeaderboardSnapshot(parsedWindowNumber);
        if (snapshot?.rows?.length) rows = snapshot.rows;
      }

      if (!rows) {
        const cacheKey = parsedWindowNumber
          ? `leaderboard:${parsedWindowNumber}`
          : LEADERBOARD_ALL_KEY;
        const cachedRows = await getCachedLeaderboardRows(cacheKey);
        if (cachedRows) {
          rows = cachedRows;
        } else {
          const fbQuery = {
            caterer: { $ne: null },
          };
          if (parsedWindowNumber) {
            fbQuery.feedbackWindowNumber = parsedWindowNumber;
          }
          const all = await Feedback.find(fbQuery)
            .populate("user", "isSMC")
            .populate("caterer", "name")
            .lean();
          rows = await buildLeaderboardRowsFromFeedbacks(all);
          await setCachedLeaderboardRows(cacheKey, rows);
        }
      }

      const row = rows.find((r) => r.catererId === String(catererId));
      if (row) {
        opi = row.overall;
        rank = row.rank;
      }
    } catch (e) {
      // If leaderboard calc fails, keep opi/rank null but do not fail the endpoint
      console.error("getFeedbacksByCaterer leaderboard calc error:", e);
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
    console.error("getFeedbacksByCaterer error:", e);
    return res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
};

// ==========================================
// Submit feedback
// ==========================================
const submitFeedback = async (req, res) => {
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

    // Auto close after 2 days
    if (settings.enabledAt) {
      const enabledAt = new Date(settings.enabledAt);
      const expiresAt = new Date(enabledAt.getTime() + 2 * 24 * 60 * 60 * 1000);
      const now = new Date();
      if (now > expiresAt) {
        settings.isEnabled = false;
        settings.disabledAt = now;
        await settings.save();
        return res.status(403).send("Mess feedback window has ended.");
      }
    }

    // Find user by unique roll number, then validate name if provided
    const user = await User.findOne({ rollNumber });
    if (!user) return res.status(404).send("User not found");
    if (name && user.name !== name) {
      return res.status(400).send("Name and roll number do not match");
    }

    // Check if feedback for this user and current window already exists
    const alreadySubmitted = await Feedback.findOne(
      {
        user: user._id,
        feedbackWindowNumber: settings.currentWindowNumber,
      },
      { _id: 1 },
    ).lean();
    if (alreadySubmitted) {
      return res.status(400).send("Feedback already submitted for this window");
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

    const feedback = new Feedback(feedbackData);
    await feedback.save();

    // Mark feedback as submitted for this window
    await User.updateOne(
      { _id: user._id, isFeedbackSubmitted: { $ne: true } },
      { $set: { isFeedbackSubmitted: true } },
    );

    await invalidateLeaderboardCache(settings.currentWindowNumber);

    res.status(200).send("Feedback submitted successfully");
  } catch (err) {
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
const removeFeedback = async (req, res) => {
  try {
    const { name, rollNumber } = req.body;
    if (!name || !rollNumber) {
      return res.status(400).send("Name and Roll Number required");
    }

    const user = await User.findOne({ rollNumber });
    if (!user) return res.status(404).send("User not found");
    if (name && user.name !== name) {
      return res.status(400).send("Name and roll number do not match");
    }

    // Get current window number
    const settings = await FeedbackSettings.findOne();
    const currentWindowNumber = settings?.currentWindowNumber || 1;

    const deleteResult = await Feedback.deleteOne({
      user: user._id,
      feedbackWindowNumber: currentWindowNumber,
    });
    if (!deleteResult.deletedCount) {
      return res.status(400).send("No feedback submitted by this user");
    }
    user.isFeedbackSubmitted = false;
    await user.save();
    await invalidateLeaderboardCache(currentWindowNumber);

    res.status(200).send("Feedback removed successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing feedback");
  }
};

// ==========================================
// Get all feedbacks
// ==========================================
const getAllFeedback = async (req, res) => {
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
    console.error("getAllFeedback error:", err);
    return res.status(500).json({
      message: "Error fetching feedbacks",
      error: String(err?.message || err),
    });
  }
};

// ==========================================
// Enable / Disable Feedback Window
// ==========================================
const enableFeedback = async (req, res) => {
  try {
    let s = await FeedbackSettings.findOne();
    if (!s) {
      s = new FeedbackSettings();
      s.currentWindowNumber = 1;
    }

    // If enabling a new window, increment window number and reset user submission flags
    if (!s.isEnabled) {
      s.currentWindowNumber += 1;
      // Reset all users' feedback submission flags for the new window
      await User.updateMany({}, { $set: { isFeedbackSubmitted: false } });
    }

    s.isEnabled = true;
    s.enabledAt = new Date();
    s.disabledAt = null;

    // Set closing time (2 days from now, end of day)
    const closingDate = new Date(s.enabledAt);
    closingDate.setDate(closingDate.getDate() + 2);
    closingDate.setHours(23, 59, 59, 999);
    s.currentWindowClosingTime = closingDate;

    await s.save();
    await invalidateLeaderboardCache(s.currentWindowNumber);
    await redisClient.del("feedback_settings");
    sendNotificationMessage(
      "MESS FEEDBACK",
      "Mess Feedback for this month is enabled",
      "All_Hostels",
      { redirectType: "mess_screen", isAlert: "true" },
    ).catch((err) => console.error("Feedback enabled notification failed:", err));
    return res.status(200).json({ message: "Feedback enabled", data: s });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to enable", error: String(e.message || e) });
  }
};

const disableFeedback = async (req, res) => {
  try {
    let s = await FeedbackSettings.findOne();
    if (!s) return res.status(404).json({ message: "Settings not found" });
    s.isEnabled = false;
    s.disabledAt = new Date();
    await s.save();
    // Call updateAllMessRatingsAndRankings with the just-closed window number
    if (typeof s.currentWindowNumber === "number") {
      await updateAllMessRatingsAndRankings(s.currentWindowNumber);
    }
    await invalidateLeaderboardCache(s.currentWindowNumber);
    await redisClient.del("feedback_settings");
    return res.status(200).json({ message: "Feedback disabled", data: s });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to disable", error: String(e.message || e) });
  }
};

// Helper to enable feedback automatically (non-Express) so schedulers can call it
const enableFeedbackAutomatic = async () => {
  try {
    let s = await FeedbackSettings.findOne();
    if (!s) {
      s = new FeedbackSettings();
      s.currentWindowNumber = 1;
    }

    // If enabling a new window, increment window number and reset user submission flags
    if (!s.isEnabled) {
      s.currentWindowNumber += 1;
      await User.updateMany({}, { $set: { isFeedbackSubmitted: false } });
    }

    s.isEnabled = true;
    s.enabledAt = new Date();
    s.disabledAt = null;

    // Set closing time (2 days from now, end of day)
    const closingDate = new Date(s.enabledAt);
    closingDate.setDate(closingDate.getDate() + 2);
    closingDate.setHours(23, 59, 59, 999);
    s.currentWindowClosingTime = closingDate;

    await s.save();
    await invalidateLeaderboardCache(s.currentWindowNumber);
    await redisClient.del("feedback_settings");
    sendNotificationMessage(
      "MESS FEEDBACK",
      "Mess Feedback for this month is enabled",
      "All_Hostels",
      { redirectType: "mess_screen", isAlert: "true" },
    ).catch((err) => console.error("Feedback enabled notification failed:", err));
    console.log("✅ Feedback enabled automatically");
    return { success: true, settings: s };
  } catch (e) {
    console.error("❌ Error enabling feedback automatically:", e);
    return { success: false, error: e };
  }
};

// Helper to disable feedback automatically (non-Express)
const disableFeedbackAutomatic = async () => {
  try {
    let s = await FeedbackSettings.findOne();
    if (!s) return { success: false, error: "Settings not found" };

    s.isEnabled = false;
    s.disabledAt = new Date();
    await s.save();
    // Call updateAllMessRatingsAndRankings with the just-closed window number
    if (typeof s.currentWindowNumber === "number") {
      await updateAllMessRatingsAndRankings(s.currentWindowNumber);
    }
    await invalidateLeaderboardCache(s.currentWindowNumber);
    await redisClient.del("feedback_settings");

    console.log("✅ Feedback disabled automatically");
    return { success: true, settings: s };
  } catch (e) {
    console.error("❌ Error disabling feedback automatically:", e);
    return { success: false, error: e };
  }
};

// ==========================================
// Get feedback settings
// ==========================================
const getFeedbackSettings = async (req, res) => {
  try {
    const cachedSettings = await redisClient.get("feedback_settings");
    if (cachedSettings) return res.status(200).json(JSON.parse(cachedSettings));

    let s = await FeedbackSettings.findOne();
    if (s?.isEnabled && s.enabledAt) {
      const expiresAt = new Date(
        new Date(s.enabledAt).getTime() + 2 * 24 * 60 * 60 * 1000,
      );
      if (new Date() > expiresAt) {
        s.isEnabled = false;
        s.disabledAt = new Date();
        await s.save();
      }
    }

    const responseData = s || {
      isEnabled: false,
      enabledAt: null,
      disabledAt: null,
      currentWindowNumber: 1,
    };

    await redisClient.set(
      "feedback_settings",
      JSON.stringify(responseData),
      "EX",
      60,
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
const getFeedbackSettingsPublic = async (req, res) => {
  try {
    const cachedSettings = await redisClient.get("feedback_settings");
    if (cachedSettings) return res.status(200).json(JSON.parse(cachedSettings));

    let s = await FeedbackSettings.findOne();
    if (s?.isEnabled && s.enabledAt) {
      const expiresAt = new Date(
        new Date(s.enabledAt).getTime() + 2 * 24 * 60 * 60 * 1000,
      );
      if (new Date() > expiresAt) {
        s.isEnabled = false;
        s.disabledAt = new Date();
        await s.save();
      }
    }

    const responseData = s || {
      isEnabled: false,
      enabledAt: null,
      disabledAt: null,
      currentWindowNumber: 1,
    };

    await redisClient.set(
      "feedback_settings",
      JSON.stringify(responseData),
      "EX",
      60,
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
// Leaderboard (All-time)
// ==========================================
const getFeedbackLeaderboard = async (req, res) => {
  try {
    const cacheKey = LEADERBOARD_ALL_KEY;
    const cachedRows = await getCachedLeaderboardRows(cacheKey);
    if (cachedRows) return res.status(200).json(cachedRows);

    const feedbacks = await Feedback.find({ caterer: { $ne: null } })
      .populate("user", "isSMC")
      .populate("caterer", "name")
      .lean();

    const rows = await buildLeaderboardRowsFromFeedbacks(feedbacks);
    await setCachedLeaderboardRows(cacheKey, rows);

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
const getAvailableWindows = async (req, res) => {
  try {
    const windows = await Feedback.distinct("feedbackWindowNumber", {
      feedbackWindowNumber: { $ne: null },
    });
    windows.sort((a, b) => b - a);
    return res.status(200).json(windows);
  } catch (e) {
    console.error("getAvailableWindows error:", e);
    return res.status(500).json({ message: "Failed to fetch windows" });
  }
};

// ==========================================
// Window-based leaderboard
// ==========================================
const getFeedbackLeaderboardByWindow = async (req, res) => {
  try {
    const { windowNumber } = req.query;

    if (!windowNumber) {
      return res.status(400).json({ message: "Window number required" });
    }

    const parsedWindowNumber = parseOptionalInt(windowNumber);
    if (parsedWindowNumber === null) {
      return res.status(400).json({ message: "Window number must be a number" });
    }

    const snapshot = await getWindowLeaderboardSnapshot(parsedWindowNumber);
    if (snapshot?.rows?.length) {
      return res.status(200).json(snapshot.rows);
    }

    const cacheKey = `leaderboard:${parsedWindowNumber}`;
    const cachedRows = await getCachedLeaderboardRows(cacheKey);
    if (cachedRows) return res.status(200).json(cachedRows);

    const feedbacks = await Feedback.find({
      caterer: { $ne: null },
      feedbackWindowNumber: parsedWindowNumber,
    })
      .populate("user", "isSMC")
      .populate("caterer", "name")
      .lean();

    const rows = await buildLeaderboardRowsFromFeedbacks(feedbacks);
    await setCachedLeaderboardRows(cacheKey, rows);

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
const checkFeedbackSubmitted = async (req, res) => {
  try {
    const user = req.user; // set by authenticateJWT
    if (!user)
      return res
        .status(401)
        .json({ submitted: false, message: "User not authenticated" });

    const settings = await FeedbackSettings.findOne({}, { currentWindowNumber: 1 })
      .lean();
    const currentWindowNumber = settings?.currentWindowNumber || 1;

    const existingFeedback = await Feedback.findOne(
      { user: user._id, feedbackWindowNumber: currentWindowNumber },
      { _id: 1 },
    ).lean();

    return res.status(200).json({ submitted: Boolean(existingFeedback) });
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
const getFeedbackWindowTimeLeft = async (req, res) => {
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
      if (hours > 0) {
        formatted = `${days} day${days > 1 ? "s" : ""} ${hours} hour${
          hours !== 1 ? "s" : ""
        }`;
      } else {
        formatted = `${days} day${days > 1 ? "s" : ""}`;
      }
      unit = "days";
    } else if (totalHours >= 1) {
      if (minutes > 0) {
        formatted = `${totalHours} hour${
          totalHours !== 1 ? "s" : ""
        } ${minutes} minute${minutes !== 1 ? "s" : ""}`;
      } else {
        formatted = `${totalHours} hour${totalHours !== 1 ? "s" : ""}`;
      }
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

const updateAllMessRatingsAndRankings = async (windowNumber) => {
  if (typeof windowNumber !== "number") return;

  // Get all messes
  const messes = await Mess.find({});
  if (!messes.length) return;
  const messNameById = new Map(messes.map((mess) => [String(mess._id), mess.name]));

  // Get all hostels — map messId → hostel._id (fixed: was inverting the relationship)
  const hostels = await Hostel.find({});
  const hostelByMess = new Map();
  for (const hostel of hostels) {
    if (hostel.messId) hostelByMess.set(String(hostel.messId), hostel._id);
  }

  // Get feedbacks only for the specified window
  const feedbacks = await Feedback.find({ feedbackWindowNumber: windowNumber })
    .populate("user", "isSMC")
    .lean();

  // Get subscriber counts per hostel (fixed: now actually filters to relevant hostelIds)
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
        subscribedHostel: { $ifNull: ["$current_subscribed_mess", "$hostel"] },
      },
    },
    {
      $group: {
        _id: "$subscribedHostel",
        count: { $sum: 1 },
      },
    },
  ]);
  const subscriberByHostel = new Map(
    subscriberRows.map((row) => [String(row._id), row.count]),
  );

  const ratingMap = {
    "Very Poor": 1,
    Poor: 2,
    Average: 3,
    Good: 4,
    "Very Good": 5,
  };

  // Group feedbacks by mess
  const groups = new Map();

  // Pre-initialise all messes so zero-feedback ones still get updated (fixed: stale ratings)
  for (const mess of messes) {
    groups.set(String(mess._id), {
      totalUsers: 0,
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

  for (const fb of feedbacks) {
    const messId = fb.caterer ? String(fb.caterer) : null;
    if (!messId || !groups.has(messId)) continue;

    const g = groups.get(messId);
    g.totalUsers += 1;
    g.breakfastSum += ratingMap[fb.breakfast] || 0;
    g.lunchSum += ratingMap[fb.lunch] || 0;
    g.dinnerSum += ratingMap[fb.dinner] || 0;

    if (fb.user?.isSMC && fb.smcFields) {
      g.smc.hygieneSum += ratingMap[fb.smcFields.hygiene] || 0;
      g.smc.wasteDisposalSum += ratingMap[fb.smcFields.wasteDisposal] || 0;
      g.smc.qualitySum += ratingMap[fb.smcFields.qualityOfIngredients] || 0;
      g.smc.uniformSum += ratingMap[fb.smcFields.uniformAndPunctuality] || 0;
      g.smc.count += 1;
    }
  }

  // Compute OPI and ranking for all messes using the same logic as getFeedbackLeaderboardByWindow
  const rows = [];
  for (const [messId, g] of groups) {
    const hostelId = hostelByMess.get(messId);
    const subscriberCount = hostelId
      ? subscriberByHostel.get(String(hostelId)) || 0
      : 0;

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
      catererId: messId,
      catererName: messNameById.get(messId) || "",
      totalUsers: g.totalUsers,
      smcUsers: g.smc.count,
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

  // Fixed: bulk update instead of sequential awaits
  await Promise.all(
    rows.map((r) =>
      Mess.findByIdAndUpdate(r.messId, { rating: r.overall, ranking: r.rank }),
    ),
  );

  await FeedbackWindowStats.findOneAndUpdate(
    { windowNumber },
    {
      $set: {
        rows: rows.map((r) => ({
          catererId: r.catererId,
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
        })),
        computedAt: new Date(),
      },
    },
    { upsert: true },
  );
};

module.exports = {
  submitFeedback,
  removeFeedback,
  getAllFeedback,
  enableFeedback,
  disableFeedback,
  enableFeedbackAutomatic,
  disableFeedbackAutomatic,
  getFeedbackSettings,
  getFeedbackSettingsPublic,
  getFeedbackLeaderboard,
  getFeedbackLeaderboardByWindow,
  getAvailableWindows,
  checkFeedbackSubmitted,
  getFeedbackWindowTimeLeft,
  getFeedbacksByCaterer,
  updateAllMessRatingsAndRankings,
};
