const { User } = require("../user/userModel");
const { Hostel } = require("../hostel/hostelModel");
const { Mess } = require("../mess/messModel");
const UserAllocHostel = require("../hostel/hostelAllocModel");
const Feedback = require("./feedbackModel");
const { FeedbackSettings } = require("./feedbackSettingsModel");
const {
  sendNotificationMessage,
} = require("../notification/notificationController");
const redisClient = require("../../utils/redisClient.js");

const ratingMap = {
  "Very Poor": 1,
  Poor: 2,
  Average: 3,
  Good: 4,
  "Very Good": 5,
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

    const query = { caterer: catererId };
    if (windowNumber) {
      query.feedbackWindowNumber = parseInt(windowNumber, 10);
    }

    const rawItems = await Feedback.find(query)
      .populate("user", "name")
      .sort({ date: -1 })
      .lean();
    const dedupedItems = dedupeByLatestUserFeedback(rawItems);
    const total = dedupedItems.length;
    const items = dedupedItems.slice((p - 1) * size, p * size);

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
      const fbQuery = {
        caterer: { $ne: null },
      };
      if (windowNumber)
        fbQuery.feedbackWindowNumber = parseInt(windowNumber, 10);
      const allRaw = await Feedback.find(fbQuery)
        .populate("user", "isSMC")
        .populate("caterer", "name")
        .sort({ date: -1 })
        .lean();
      const all = dedupeFeedbacksForAggregation(allRaw, {
        includeWindowInKey: !windowNumber,
      });

      const groups = new Map();
      const toScore = (label) => ratingMap[label] ?? null;
      for (const fb of all) {
        const key = String(fb.caterer._id);
        if (!groups.has(key)) {
          groups.set(key, {
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
      for (const [key, g] of groups) {
        const subscriberCount = subscriberCountByCaterer.get(String(key)) || 0;
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
        const avgHygiene = g.smc.count ? g.smc.hygieneSum / g.smc.count : 0;
        const avgWasteDisposal = g.smc.count
          ? g.smc.wasteDisposalSum / g.smc.count
          : 0;
        const avgQualityOfIngredients = g.smc.count
          ? g.smc.qualitySum / g.smc.count
          : 0;
        const avgUniformAndPunctuality = g.smc.count
          ? g.smc.uniformSum / g.smc.count
          : 0;

        const overall = computeOverallOpi({
          breakfastAvg: avgBreakfast,
          lunchAvg: avgLunch,
          dinnerAvg: avgDinner,
          uniformAvg: avgUniformAndPunctuality,
          cleanlinessAvg: avgHygiene,
          wasteAvg: avgWasteDisposal,
          qualityAvg: avgQualityOfIngredients,
        });
        rows.push({ catererId: key, overall });
      }
      rows.sort((a, b) => b.overall - a.overall);
      rows.forEach((r, i) => (r.rank = i + 1));
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
// Detailed feedback rows for a specific window (HAB/Admin)
// Query params: windowNumber (required)
// Response: [{ userName, rollNumber, breakfast, lunch, dinner, smcFields, comment, catererName, date }]
// ==========================================
const getDetailedFeedbackByWindow = async (req, res) => {
  try {
    const { windowNumber } = req.query;
    const parsedWindow = parseInt(windowNumber, 10);

    if (!parsedWindow || Number.isNaN(parsedWindow)) {
      return res
        .status(400)
        .json({ message: "Valid windowNumber is required" });
    }

    const feedbacks = await Feedback.find({
      caterer: { $ne: null },
      feedbackWindowNumber: parsedWindow,
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
    console.error("getDetailedFeedbackByWindow error:", e);
    return res.status(500).json({
      message: "Failed to fetch detailed feedback by window",
      error: String(e.message || e),
    });
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

    // Enforce feedback window closing time
    if (settings.currentWindowClosingTime) {
      const expiresAt = new Date(settings.currentWindowClosingTime);
      const now = new Date();
      if (now > expiresAt) {
        // Don't silently disable here — let the scheduler handle it
        // so that updateAllMessRatingsAndRankings is properly called.
        return res.status(403).send("Mess feedback window has ended.");
      }
    }

    // Find user
    const user = await User.findOne({ name, rollNumber });
    if (!user) return res.status(404).send("User not found");

    // Check if feedback for this user and current window already exists
    if (user.isFeedbackSubmitted) {
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

    const existingFeedback = await Feedback.findOne({
      user: user._id,
      feedbackWindowNumber: settings.currentWindowNumber,
    }).lean();
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

    const user = await User.findOne({ name, rollNumber });
    if (!user) return res.status(404).send("User not found");

    if (!user.isFeedbackSubmitted) {
      return res.status(400).send("No feedback submitted by this user");
    }

    // Get current window number
    const settings = await FeedbackSettings.findOne();
    const currentWindowNumber = settings?.currentWindowNumber || 1;

    await Feedback.deleteOne({
      user: user._id,
      feedbackWindowNumber: currentWindowNumber,
    });
    user.isFeedbackSubmitted = false;
    await user.save();

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
    sendNotificationMessage(
      "MESS FEEDBACK",
      "Mess Feedback for this month is enabled",
      "All_Hostels",
      { redirectType: "mess_screen", isAlert: "true" },
    ).catch((err) =>
      console.error("Feedback enabled notification failed:", err),
    );
    await redisClient.del("feedback_settings");
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
    await redisClient.del("feedback_settings");
    return res.status(200).json({ message: "Feedback disabled", data: s });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to disable", error: String(e.message || e) });
  }
};

// Helper to get feedback window dates for a given month
// Duplicated from autoFeedbackScheduler to avoid circular dependency
const getFeedbackWindowDates = (targetMonth = null, targetYear = null) => {
  const now = new Date();
  const year = targetYear || now.getFullYear();
  const month = targetMonth !== null ? targetMonth : now.getMonth(); // 0-11

  let startDay, endDay;
  if (month === 1) {
    // February
    startDay = 23;
    endDay = 25;
  } else {
    // All other months
    startDay = 25;
    endDay = 27;
  }

  const startDate = new Date(year, month, startDay, 9, 0, 0);
  const endDate = new Date(year, month, endDay, 23, 59, 59);
  return { startDate, endDate };
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

    // Set closing time to the scheduled window end date
    const { endDate } = getFeedbackWindowDates();
    s.currentWindowClosingTime = endDate;

    await s.save();
    sendNotificationMessage(
      "MESS FEEDBACK",
      "Mess Feedback for this month is enabled",
      "All_Hostels",
      { redirectType: "mess_screen", isAlert: "true" },
    ).catch((err) =>
      console.error("Feedback enabled notification failed:", err),
    );
    console.log("✅ Feedback enabled automatically");
    await redisClient.del("feedback_settings");
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

    console.log("✅ Feedback disabled automatically");
    await redisClient.del("feedback_settings");
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
    // Check if window has expired and report accordingly, but don't
    // persist the disable — let the scheduler handle it so
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
    const feedbacksRaw = await Feedback.find({ caterer: { $ne: null } })
      .populate("user", "isSMC")
      .populate("caterer", "name")
      .sort({ date: -1 })
      .lean();
    const feedbacks = dedupeFeedbacksForAggregation(feedbacksRaw, {
      includeWindowInKey: true,
    });

    const toScore = (label) => ratingMap[label] ?? null;
    const groups = new Map();

    for (const fb of feedbacks) {
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
    const windows = await Feedback.distinct("feedbackWindowNumber");
    const sorted = windows.filter(Boolean).sort((a, b) => b - a); // Sort descending (newest first)
    return res.status(200).json(sorted);
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

    const feedbacksRaw = await Feedback.find({
      caterer: { $ne: null },
      feedbackWindowNumber: parseInt(windowNumber),
    })
      .populate("user", "isSMC")
      .populate("caterer", "name")
      .sort({ date: -1 })
      .lean();
    const feedbacks = dedupeFeedbacksForAggregation(feedbacksRaw);

    const toScore = (label) => ratingMap[label] ?? null;
    const groups = new Map();

    for (const fb of feedbacks) {
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

    // Check if user has submitted feedback for current window
    if (user.isFeedbackSubmitted) {
      return res.status(200).json({ submitted: true });
    } else {
      return res.status(200).json({ submitted: false });
    }
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

  const startTime = Date.now();
  console.log(`⏱️ Starting mess ratings update for window ${windowNumber}...`);

  // Get all messes and hostels
  const messes = await Mess.find({}, { _id: 1, hostelId: 1 }).lean();
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
    { $match: { feedbackWindowNumber: windowNumber, caterer: { $ne: null } } },
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
      $addFields: {
        isSMC: { $ifNull: ["$userData.isSMC", false] },
      },
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
  for (const row of feedbackAgg) {
    aggByMess.set(String(row._id), row);
  }

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

    rows.push({ messId, overall });
  }

  rows.sort((a, b) => b.overall - a.overall);
  rows.forEach((r, i) => (r.rank = i + 1));

  // Single bulk write instead of individual findByIdAndUpdate calls
  if (rows.length > 0) {
    const bulkOps = rows.map((r) => ({
      updateOne: {
        filter: { _id: r.messId },
        update: { $set: { rating: r.overall, ranking: r.rank } },
      },
    }));
    await Mess.bulkWrite(bulkOps);
  }

  console.log(
    `✅ Mess ratings updated for ${rows.length} messes in ${Date.now() - startTime}ms`,
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
  getDetailedFeedbackByWindow,
  updateAllMessRatingsAndRankings,
};
