import { logger } from "../../logging/logger.js";
import { API_VERSION } from "../../config/default.js";
import bcrypt from "bcrypt";

import { User } from "../user/userModel.js";
import { Hostel } from "./hostelModel.js";

import { getCurrentDate } from "../../utils/date.js";
import {
  populateCurrSubscribedMess,
  subscribedMessDisplayName,
} from "../../utils/subscribedMessDisplay.js";
import redisClient from "../../utils/redisClient.js";
import UserAllocHostel from "./hostelAllocModel.js";
import { getNowIST } from "../reports/reportUtils.js";
import { MessSubscribersSnapshot } from "../reports/messSubscribersSnapshotModel.js";

const ALLOC_POPULATE_MESS = {
  path: "current_subscribed_mess",
  select: "hostel_name messId",
  populate: { path: "messId", select: "name" },
};

async function usersByRollNumbers(rollNumbers) {
  const rolls = [...new Set(rollNumbers.filter(Boolean).map(String))];
  if (!rolls.length) return new Map();
  const users = await User.find({ rollNumber: { $in: rolls } })
    .select(
      "name rollNumber email roomNumber phoneNumber degree hostel",
    )
    .populate("hostel", "hostel_name")
    .lean();
  return new Map(users.map((u) => [String(u.rollNumber), u]));
}

export const createHostel = async (req, res) => {
  try {
    const {
      hostel_name,
      microsoft_email,
      secretary_email,
      curr_cap,
      password,
    } = req.body;

    if (!microsoft_email) {
      return res.status(400).json({ message: "Microsoft email is required" });
    }

    const hostelData = {
      hostel_name,
      microsoft_email,
      secretary_email,
      curr_cap,
    };

    // If an initial hostel password is provided, hash and store it securely.
    if (password && typeof password === "string" && password.trim().length) {
      const saltRounds = 10;
      hostelData.managerPasswordHash = await bcrypt.hash(
        password.trim(),
        saltRounds,
      );
    }

    const hostel = await Hostel.create(hostelData);

    // Invalidate global hostel lists
    await redisClient.del("all_hostels");
    await redisClient.del("all_hostels_with_mess");
    await redisClient.del("hostel_name_and_caterer");

    return res
      .status(201)
      .json({ message: "Hostel created successfully", hostel });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "Hostel name or email already exists" });
    }
    return res.status(500).json({ message: "Error occurred" });
  }
};

/**
 * HAB: Set or update the password for a hostel (encrypted with bcrypt).
 * Body: { hostelId, password }
 */
export const setHostelPassword = async (req, res) => {
  try {
    const { hostelId, password } = req.body;

    if (!hostelId || !password || !String(password).trim().length) {
      return res.status(400).json({
        message: "hostelId and a non-empty password are required",
      });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const saltRounds = 10;
    hostel.managerPasswordHash = await bcrypt.hash(
      String(password).trim(),
      saltRounds,
    );
    await hostel.save();

    // Invalidate single hostel caches to reflect potential changes
    await redisClient.del(`hostel_${hostelId}`);
    await clearCacheByPattern(`hostel_by_id_${hostelId}*`);

    return res
      .status(200)
      .json({ message: "Hostel password set successfully" });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error setting hostel password" });
  }
};

export const getHostel = async (req, res) => {
  try {
    // Fetch the hostel with populated messId
    const cacheKey = `hostel_${req.hostel._id}`;
    const cachedHostel = await redisClient.get(cacheKey);
    if (cachedHostel) {
      return res.json({ hostel: JSON.parse(cachedHostel) });
    }
    const hostel = await Hostel.findById(req.hostel._id)
      .populate("messId")
      .lean();
    // Cache the hostel data for 1 hour
    await redisClient.set(cacheKey, JSON.stringify(hostel), "EX", 3600);
    return res.json({ hostel });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

export const getAllHostels = async (req, res) => {
  try {
    const cacheKey = "all_hostels";

    // Fail-safe Redis check
    try {
      if (redisClient) {
        const cachedHostels = await redisClient.get(cacheKey);
        if (cachedHostels)
          return res.status(200).json(JSON.parse(cachedHostels));
      }
    } catch (redisErr) {
      logger.error("Redis get error:", { error: redisErr });
    }

    // CRITICAL FIX: Exclude the password hash!
    const hostels = await Hostel.find().select("-managerPasswordHash").lean();

    try {
      if (redisClient)
        await redisClient.set(cacheKey, JSON.stringify(hostels), "EX", 3600);
    } catch (redisErr) {
      logger.error("Redis set error:", { error: redisErr });
    }

    return res.status(200).json(hostels);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

export const getAllHostelsWithMess = async (req, res) => {
  try {
    const cacheKey = "all_hostels_with_mess";

    try {
      if (redisClient) {
        const cachedHostels = await redisClient.get(cacheKey);
        if (cachedHostels)
          return res.json({ hostels: JSON.parse(cachedHostels) });
      }
    } catch (redisErr) {
      logger.error("Redis get error:", { error: redisErr });
    }

    // CRITICAL FIX: Exclude the password hash!
    const hostels = await Hostel.find()
      .populate("messId")
      .select("-managerPasswordHash")
      .lean();

    try {
      if (redisClient)
        await redisClient.set(cacheKey, JSON.stringify(hostels), "EX", 3600);
    } catch (redisErr) {
      logger.error("Redis set error:", { error: redisErr });
    }

    return res.status(200).json(hostels);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

export const getHostelbyId = async (req, res) => {
  const { hostelId } = req.params;
  try {
    const cacheKey = `hostel_by_id_${hostelId}`;
    // Fail-safe Redis check (do not 500 if Redis is down)
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res
          .status(200)
          .json({ message: "Hostel found", hostel: JSON.parse(cachedData) });
      }
    } catch (redisErr) {
      logger.error("Redis get error:", { error: redisErr });
    }

    const [hostel, users, totalUsersCount] = await Promise.all([
      Hostel.findById(hostelId).populate("messId", "name").lean(),
      User.find({ hostel: hostelId })
        .select(
          "name rollNumber email roomNumber phoneNumber degree curr_subscribed_mess",
        )
        .populate(populateCurrSubscribedMess)
        .sort({ rollNumber: 1 })
        .lean(),
      User.countDocuments({ hostel: hostelId }),
    ]);

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    // Format users to match the expected structure (with user wrapper)
    const formattedUsers = users.map((user) => ({
      user: {
        _id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
        email: user.email,
        // include roomNumber and phoneNumber so frontend can display them
        roomNumber: user.roomNumber || "N/A",
        phoneNumber: user.phoneNumber || "N/A",
        degree: user.degree,
        curr_subscribed_mess_name:
          subscribedMessDisplayName(user.curr_subscribed_mess) || "N/A",
      },
    }));
    const hostelWithUsers = {
      ...hostel,
      totalUsersCount,
      users: formattedUsers,
    };

    try {
      await redisClient.set(
        cacheKey,
        JSON.stringify(hostelWithUsers),
        "EX",
        3600,
      );
    } catch (redisErr) {
      logger.error("Redis set error:", { error: redisErr });
    }

    return res
      .status(200)
      .json({ message: "Hostel found", hostel: hostelWithUsers });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Hostel deletion endpoint removed. Deleting hostels from the system is disallowed per new policy.

export const getAllHostelNameAndCaterer = async (req, res) => {
  try {
    const cacheKey = "hostel_name_and_caterer";
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const hostelData = await Hostel.find({}, { hostel_name: 1, messId: 1 })
      .populate({
        path: "messId",
        select: "name -_id",
      })
      .lean();

    // Use aggregation to group and count users per hostel in a single query
    const userCounts = await User.aggregate([
      { $group: { _id: "$hostel", count: { $sum: 1 } } },
    ]);

    // Create a map for quick O(1) lookups in memory
    const countMap = {};
    userCounts.forEach((item) => {
      if (item._id) {
        countMap[item._id.toString()] = item.count;
      }
    });

    const hostelDataWithUserCount = hostelData.map((hostel) => ({
      ...hostel,
      user_count: countMap[hostel._id.toString()] || 0,
    }));

    await redisClient.set(
      cacheKey,
      JSON.stringify(hostelDataWithUserCount),
      "EX",
      3600,
    );

    res.status(200).json(hostelDataWithUserCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get caterer info for the logged-in hostel
export const getCatererInfo = async (req, res) => {
  try {
    const cacheKey = `hostel_${req.hostel._id}_caterer_info`;
    const cachedInfo = await redisClient.get(cacheKey);
    if (cachedInfo) {
      return res.json(JSON.parse(cachedInfo));
    }
    const hostel = await Hostel.findById(req.hostel._id)
      .populate("messId")
      .lean();
    if (!hostel || !hostel.messId) {
      return res
        .status(404)
        .json({ message: "Caterer not assigned to this hostel" });
    }

    const mess = hostel.messId;
    const responsePayload = {
      messId: mess._id,
      catererName: mess.name,
      rating: mess.rating,
      ranking: mess.ranking,
      hostelName: hostel.hostel_name,
    };
    await redisClient.set(
      cacheKey,
      JSON.stringify(responsePayload),
      "EX",
      3600,
    );
    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get boarders from UserAllocHostel (boarding hostel), merged with User by roll
export const getBoarders = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const cacheKey = `hostel_${hostelId}_boarders_alloc_${API_VERSION}`;
    const cachedBoarders = await redisClient.get(cacheKey);
    if (cachedBoarders) {
      return res.status(200).json(JSON.parse(cachedBoarders));
    }

    const allocs = await UserAllocHostel.find({ hostel: hostelId })
      .sort({ rollno: 1 })
      .lean();

    const byRoll = await usersByRollNumbers(allocs.map((a) => a.rollno));

    const boarders = allocs.map((a) => {
      const u = byRoll.get(String(a.rollno));
      return {
        _id: u?._id ?? a._id,
        name: u?.name ?? "N/A",
        rollNumber: a.rollno,
        email: u?.email ?? "N/A",
        phoneNumber: u?.phoneNumber || "N/A",
        roomNumber: u?.roomNumber || "N/A",
        degree: u?.degree || "N/A",
      };
    });

    const totalCount = allocs.length;

    const responsePayload = {
      count: boarders.length,
      totalCount,
      boarders,
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify(responsePayload),
      "EX",
      3600,
    );
    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Helper function to format and sort mess subscribers
export const formatMessSubscribers = (subscribers, hostelId) => {
  const subscribersList = subscribers.map((sub) => {
    const boardingId = sub.hostel?._id;
    const isDifferentHostel =
      Boolean(boardingId) &&
      boardingId.toString() !== hostelId.toString();

    return {
      _id: sub._id,
      name: sub.name,
      rollNumber: sub.rollNumber,
      email: sub.email,
      phoneNumber: sub.phoneNumber || "N/A",
      roomNumber: sub.roomNumber || "N/A",
      currentHostel: sub.hostel ? sub.hostel.hostel_name : "N/A",
      currentSubscribedMess:
        subscribedMessDisplayName(sub.curr_subscribed_mess) || "N/A",
      isDifferentHostel: isDifferentHostel,
    };
  });

  // Sort: different hostel first (marked)
  subscribersList.sort((a, b) => {
    if (a.isDifferentHostel && !b.isDifferentHostel) return -1;
    if (!a.isDifferentHostel && b.isDifferentHostel) return 1;
    // Database already sorts by rollNumber, but this ensures stability
    return 0;
  });

  return subscribersList;
};

async function buildMessSubscribersFromSnapshot(hostelId, month, year) {
  const snap = await MessSubscribersSnapshot.findOne({
    hostelId,
    month,
    year,
  }).lean();

  if (!snap?.subscribers?.length) {
    return {
      subscribers: [],
      totalCount: 0,
      source: "snapshot",
      month,
      year,
    };
  }

  const messHostel = await Hostel.findById(hostelId)
    .select("hostel_name messId")
    .populate({ path: "messId", select: "name" })
    .lean();

  const byRoll = await usersByRollNumbers(
    snap.subscribers.map((s) => s.rollNumber),
  );

  const merged = snap.subscribers.map((row, idx) => {
    const u = byRoll.get(String(row.rollNumber));
    const boarding =
      row.boardingHostelId != null
        ? {
            _id: row.boardingHostelId,
            hostel_name: row.boardingHostelName || "",
          }
        : row.boardingHostelName
          ? { hostel_name: row.boardingHostelName }
          : null;

    const caterer =
      messHostel?.messId &&
      typeof messHostel.messId === "object" &&
      messHostel.messId.name
        ? { name: messHostel.messId.name }
        : undefined;
    const currSub = {
      hostel_name:
        row.subscribedMessHostelName || messHostel?.hostel_name || "",
      ...(caterer ? { messId: caterer } : {}),
    };

    return {
      _id: u?._id ?? `${String(row.rollNumber)}_${idx}`,
      name: u?.name ?? "N/A",
      rollNumber: row.rollNumber,
      email: u?.email ?? "N/A",
      phoneNumber: u?.phoneNumber,
      roomNumber: u?.roomNumber,
      hostel: boarding,
      curr_subscribed_mess: currSub,
    };
  });

  const subscribersList = formatMessSubscribers(merged, hostelId);

  return {
    subscribers: subscribersList,
    totalCount: snap.totalCount ?? subscribersList.length,
    source: "snapshot",
    month,
    year,
  };
}

/** Months/years that have a MessSubscribersSnapshot for this mess hostel (IST “current” also returned for UI). */
export const getMessSubscribersSnapshotMonths = async (req, res) => {
  try {
    const hostelId = req.hostel?._id;
    if (!hostelId) return res.status(403).json({ message: "Unauthorized" });

    const nowIST = getNowIST();
    const currentMonth = nowIST.getMonth() + 1;
    const currentYear = nowIST.getFullYear();

    const raw = await MessSubscribersSnapshot.find({ hostelId })
      .select("month year")
      .sort({ year: -1, month: -1 })
      .lean();

    const seen = new Set();
    const snapshots = [];
    for (const r of raw) {
      const key = `${r.year}-${r.month}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snapshots.push({ month: r.month, year: r.year });
    }

    return res.status(200).json({
      currentMonth,
      currentYear,
      snapshots,
    });
  } catch (err) {
    logger.error("Error listing mess subscriber snapshot months:", { error: err });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get mess subscribers from UserAllocHostel (subscribed mess), merged with User by roll;
// or from MessSubscribersSnapshot when ?month=&year= is a past/archived month.
export const getMessSubscribers = async (req, res) => {
  try {
    const hostelId = req.hostel._id;

    const nowIST = getNowIST();
    const currentMonth = nowIST.getMonth() + 1;
    const currentYear = nowIST.getFullYear();

    const qMonth = req.query?.month != null ? Number(req.query.month) : null;
    const qYear = req.query?.year != null ? Number(req.query.year) : null;
    const snapshotFlag =
      req.query?.snapshot === "1" || req.query?.snapshot === "true";
    const wantsSnapshot =
      snapshotFlag &&
      qMonth != null &&
      qYear != null &&
      !Number.isNaN(qMonth) &&
      !Number.isNaN(qYear) &&
      qMonth >= 1 &&
      qMonth <= 12;

    if (wantsSnapshot) {
      const payload = await buildMessSubscribersFromSnapshot(
        hostelId,
        qMonth,
        qYear,
      );
      return res.status(200).json({
        count: payload.subscribers.length,
        totalCount: payload.totalCount,
        subscribers: payload.subscribers,
        source: payload.source,
        month: payload.month,
        year: payload.year,
      });
    }

    const cacheKey = `hostel_${hostelId}_mess_subscribers_alloc_${API_VERSION}`;
    const cachedSubscribers = await redisClient.get(cacheKey);
    if (cachedSubscribers) {
      const parsed = JSON.parse(cachedSubscribers);
      return res.status(200).json({
        ...parsed,
        source: "live",
        month: currentMonth,
        year: currentYear,
      });
    }

    const [allocs, totalCount] = await Promise.all([
      UserAllocHostel.find({ current_subscribed_mess: hostelId })
        .populate("hostel", "hostel_name")
        .populate(ALLOC_POPULATE_MESS)
        .sort({ rollno: 1 })
        .lean(),
      UserAllocHostel.countDocuments({ current_subscribed_mess: hostelId }),
    ]);

    const byRoll = await usersByRollNumbers(allocs.map((a) => a.rollno));

    const merged = allocs.map((a) => {
      const u = byRoll.get(String(a.rollno));
      return {
        _id: u?._id ?? a._id,
        name: u?.name ?? "N/A",
        rollNumber: a.rollno,
        email: u?.email ?? "N/A",
        phoneNumber: u?.phoneNumber,
        roomNumber: u?.roomNumber,
        hostel: a.hostel,
        curr_subscribed_mess: a.current_subscribed_mess,
      };
    });

    const subscribersList = formatMessSubscribers(merged, hostelId);

    const responsePayload = {
      count: subscribersList.length,
      totalCount,
      subscribers: subscribersList,
      source: "live",
      month: currentMonth,
      year: currentYear,
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify({
        count: responsePayload.count,
        totalCount: responsePayload.totalCount,
        subscribers: responsePayload.subscribers,
      }),
      "EX",
      3600,
    );
    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get mess subscriber count for a selected month/year.
// - For current month (IST), returns live count from UserAllocHostel.
// - For older months, returns snapshot count from MessSubscribersSnapshot.
export const getMessSubscribersCountByMonth = async (req, res) => {
  try {
    const hostelId = req.hostel?._id;
    if (!hostelId) return res.status(403).json({ message: "Unauthorized" });

    const month = Number(req.query?.month);
    const year = Number(req.query?.year);
    if (!month || month < 1 || month > 12 || !year) {
      return res.status(400).json({ message: "month and year are required" });
    }

    const nowIST = getNowIST();
    const currentMonth = nowIST.getMonth() + 1;
    const currentYear = nowIST.getFullYear();

    // Current month => compute live count from allocation table
    if (month === currentMonth && year === currentYear) {
      const count = await UserAllocHostel.countDocuments({
        current_subscribed_mess: hostelId,
      });
      return res.status(200).json({ count, source: "live" });
    }

    const snap = await MessSubscribersSnapshot.findOne({
      hostelId,
      month,
      year,
    })
      .select("totalCount")
      .lean();

    return res
      .status(200)
      .json({ count: snap?.totalCount || 0, source: "snapshot" });
  } catch (err) {
    logger.error("Error fetching mess subscriber count by month:", { error: err });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Public variant: get mess subscribers by hostelId param
export const getMessSubscribersByHostelId = async (req, res) => {
  try {
    const { hostelId } = req.params;
    if (!hostelId) {
      return res.status(400).json({ message: "Hostel ID is required" });
    }

    const page = parseInt(req.query.page) || 1;
    // For the public variant, keep a conservative default page size.
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const cacheKey = `hostel_${hostelId}_mess_subscribers_public_alloc_${API_VERSION}_pg${page}_limit${limit}`;
    const cachedSubscribers = await redisClient.get(cacheKey);
    if (cachedSubscribers) {
      return res.status(200).json(JSON.parse(cachedSubscribers));
    }

    const baseQuery = UserAllocHostel.find({
      current_subscribed_mess: hostelId,
    })
      .populate("hostel", "hostel_name")
      .populate(ALLOC_POPULATE_MESS)
      .sort({ rollno: 1 });

    const [allocs, totalCount] = await Promise.all([
      limit > 0 ? baseQuery.skip(skip).limit(limit).lean() : baseQuery.lean(),
      UserAllocHostel.countDocuments({ current_subscribed_mess: hostelId }),
    ]);

    const byRoll = await usersByRollNumbers(allocs.map((a) => a.rollno));

    const merged = allocs.map((a) => {
      const u = byRoll.get(String(a.rollno));
      return {
        _id: u?._id ?? a._id,
        name: u?.name ?? "N/A",
        rollNumber: a.rollno,
        email: u?.email ?? "N/A",
        phoneNumber: u?.phoneNumber,
        roomNumber: u?.roomNumber,
        hostel: a.hostel,
        curr_subscribed_mess: a.current_subscribed_mess,
      };
    });

    const subscribersList = formatMessSubscribers(merged, hostelId);

    const responsePayload = {
      count: subscribersList.length,
      totalCount: totalCount,
      subscribers: subscribersList,
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify(responsePayload),
      "EX",
      3600,
    );
    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Mark user as SMC member
export const markAsSMC = async (req, res) => {
  try {
    const { userId } = req.body;
    const hostelId = req.hostel._id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify user is a boarder of this hostel
    if (user.hostel.toString() !== hostelId.toString()) {
      return res.status(403).json({
        message: "User is not a boarder of this hostel",
      });
    }

    user.isSMC = true;
    await user.save();

    // Invalidate SMC cached list for this hostel
    await redisClient.del(`hostel_${hostelId}_smc_members`);

    return res.status(200).json({
      message: "User marked as SMC member successfully",
      user: {
        _id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
        isSMC: user.isSMC,
      },
    });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Unmark user as SMC member
export const unmarkAsSMC = async (req, res) => {
  try {
    const { userId } = req.body;
    const hostelId = req.hostel._id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify user is a boarder of this hostel
    if (user.hostel.toString() !== hostelId.toString()) {
      return res.status(403).json({
        message: "User is not a boarder of this hostel",
      });
    }

    user.isSMC = false;
    await user.save();

    // Invalidate SMC cached list for this hostel
    await redisClient.del(`hostel_${hostelId}_smc_members`);

    return res.status(200).json({
      message: "User unmarked as SMC member successfully",
      user: {
        _id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
        isSMC: user.isSMC,
      },
    });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get SMC members for this hostel
export const getSMCMembers = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const cacheKey = `hostel_${hostelId}_smc_members`;

    try {
      if (redisClient) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (redisErr) {
      logger.error("Redis error:", { error: redisErr });
    }

    const smcMembers = await User.find({
      hostel: hostelId,
      isSMC: true,
    })
      .select("name rollNumber email roomNumber degree")
      .sort({ rollNumber: 1 });

    const responsePayload = {
      count: smcMembers.length,
      smcMembers: smcMembers.map((m) => ({
        _id: m._id,
        name: m.name,
        rollNumber: m.rollNumber,
        email: m.email,
        roomNumber: m.roomNumber || "N/A",
        degree: m.degree || "N/A",
      })),
    };

    try {
      if (redisClient)
        await redisClient.set(
          cacheKey,
          JSON.stringify(responsePayload),
          "EX",
          3600,
        );
    } catch (redisErr) {
      logger.error("Redis error:", { error: redisErr });
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occurred" });
  }
};

export const getHMCMembers = async (req, res) => {
  try {
    let hostelId;
    if (req.hostel) {
      hostelId = req.hostel._id;
    } else if (req.user && req.user.hostel) {
      hostelId = req.user.hostel;
    } else {
      return res.status(400).json({ message: "Hostel not found" });
    }

    const cacheKey = `hostel_${hostelId}_hmc_members`;

    try {
      if (redisClient) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (redisErr) {
      logger.error("Redis error:", { error: redisErr });
    }

    const hostel = await Hostel.findById(hostelId)
      .populate(
        "hmcMembers.user",
        "name email phoneNumber profilePictureUrl rollNumber roomNumber",
      )
      .lean();

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const responsePayload = {
      count: hostel.hmcMembers?.length || 0,
      hmcMembers: hostel.hmcMembers || [],
    };

    try {
      if (redisClient)
        await redisClient.set(
          cacheKey,
          JSON.stringify(responsePayload),
          "EX",
          3600,
        );
    } catch (redisErr) {
      logger.error("Redis error:", { error: redisErr });
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error fetching HMC members" });
  }
};

export const setHMCMembers = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const { hmcMembers } = req.body;

    if (!Array.isArray(hmcMembers)) {
      return res.status(400).json({ message: "hmcMembers must be an array" });
    }

    if (hmcMembers.length > 0) {
      const userIds = hmcMembers.map((m) => m.user);
      const users = await User.find({ _id: { $in: userIds } });

      if (users.length !== userIds.length) {
        return res
          .status(400)
          .json({ message: "One or more user IDs are invalid" });
      }

      for (const user of users) {
        if (!user.hostel || user.hostel.toString() !== hostelId.toString()) {
          return res.status(403).json({
            message: `User ${user.name || user._id} does not belong to this hostel`,
          });
        }
      }
    }

    const hostel = await Hostel.findByIdAndUpdate(
      hostelId,
      { hmcMembers },
      { new: true },
    ).populate(
      "hmcMembers.user",
      "name email phoneNumber profilePictureUrl rollNumber roomNumber",
    );

    await redisClient.del(`hostel_${hostelId}_hmc_members`);

    return res.status(200).json({
      message: "HMC members updated successfully",
      count: hostel.hmcMembers?.length || 0,
      hmcMembers: hostel.hmcMembers || [],
    });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error updating HMC members" });
  }
};
