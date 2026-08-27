import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";

import { User } from "./userModel.js";
import Feedback from "../feedback/feedbackModel.js";
import { ScanLogs } from "../mess/ScanLogsModel.js";
import Leave from "../leave/leaveModel.js";
import FCMToken from "../notification/FCMToken.js";
import { MenuItem } from "../mess/menuItemModel.js";
import { MessChange } from "../mess_change/messChangeModel.js";
import UserAllocHostel from "../hostel/hostelAllocModel.js";

import {
  populateCurrSubscribedMess,
  subscribedMessDisplayName,
} from "../../utils/subscribedMessDisplay.js";
import AppError from "../../utils/appError.js";
import redisClient from "../../utils/redisClient.js";
import { clearCacheByPattern } from "../../utils/redisUtils.js";
import { getCurrentDate } from "../../utils/date.js";

export const getUserData = async (req, res, next) => {
  if (req.user) {
    const u = await User.findById(req.user._id)
      .populate("hostel", "hostel_name")
      .populate(populateCurrSubscribedMess)
      .lean();
    if (!u) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({
      ...u,
      hostel_name: u.hostel?.hostel_name ?? null,
      curr_subscribed_mess_name: subscribedMessDisplayName(
        u.curr_subscribed_mess,
      ),
    });
  }

  if (req.hostel) {
    return res.json({
      _id: req.hostel._id,
      name: req.hostel.hostel_name,
      email: req.hostel.secretary_email || req.hostel.microsoft_email,
      hostel: req.hostel._id,
      isSMC: true,
      isSecretary: true,
    });
  }

  return res.status(401).json({ message: "Unauthorized" });
};

export const getUserByRoll = async (req, res) => {
  const { qr } = req.params;

  try {
    const cacheKey = `user_by_roll_${qr}`;
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return res
        .status(200)
        .json({ message: "User found", user: JSON.parse(cachedUser) });
    }

    const user = await User.findOne({ rollNumber: qr }).lean();

    if (!user) {
      return res.status(400).json({ message: "No such roll exists" });
    }

    await redisClient.set(cacheKey, JSON.stringify(user), "EX", 3600);
    return res.status(200).json({ message: "User found", user: user });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error occured" });
  }
};

export const createUser = async (req, res) => {
  try {
    const fetchedUser = await User.findOne({ email: req.body.email });
    if (fetchedUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const user = await User.create(req.body);

    const token = user.generateJWT();

    // Cache invalidation
    await redisClient.del("all_users");
    await redisClient.del("user_count");

    res.status(201).json({
      message: "User created successfully",
      token,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: "Error creating user", error: err });
    logger.error("Operation failed", { error: err });
  }
};

export const deleteUser = async (req, res) => {
  const { outlook } = req.params;
  try {
    const deletedUser = await User.findOneAndDelete({ outlookID: outlook });
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Cache invalidation
    await redisClient.del("all_users");
    await redisClient.del("user_count");
    await redisClient.del(`user_by_roll_${deletedUser.rollNumber}`);
    await redisClient.del(`user_for_manager_${deletedUser._id}`);

    if (deletedUser.hostel) {
      await clearCacheByPattern(`hostel_${deletedUser.hostel}*`);
    }
    if (deletedUser.curr_subscribed_mess) {
      await clearCacheByPattern(`hostel_${deletedUser.curr_subscribed_mess}*`);
    }

    res.status(200).json(deletedUser);
  } catch (err) {
    res.status(500).json({ message: "Error deleting user" });
  }
};

export const updateUser = async (req, res) => {
  const { outlook } = req.params;
  try {
    const updatedUser = await User.findOneAndUpdate(
      { email: outlook },
      req.body,
      { new: true },
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Cache invalidation
    await redisClient.del("all_users");
    await redisClient.del(`user_by_roll_${updatedUser.rollNumber}`);
    await redisClient.del(`user_for_manager_${updatedUser._id}`);

    // Invalidate related hostel caches if necessary
    if (updatedUser.hostel) {
      await clearCacheByPattern(`hostel_${updatedUser.hostel}*`);
    }
    if (updatedUser.curr_subscribed_mess) {
      await clearCacheByPattern(`hostel_${updatedUser.curr_subscribed_mess}*`);
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    res.status(500).json({ message: "Error updating user" });
  }
};

// Update roomNumber and phoneNumber for the authenticated user
export const saveUserProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { roomNumber, phoneNumber } = req.body;
    let changed = false;

    // Handle roomNumber: accept string (including empty string) or null/undefined
    if (roomNumber !== undefined) {
      user.roomNumber = roomNumber || null; // Convert empty string to null
      changed = true;
    }

    // Handle phoneNumber: accept string (including empty string) or null/undefined
    if (phoneNumber !== undefined) {
      user.phoneNumber = phoneNumber || null; // Convert empty string to null
      changed = true;
    }

    if (changed) {
      await user.save();

      // Cache invalidation
      await redisClient.del("all_users");
      await redisClient.del(`user_by_roll_${user.rollNumber}`);
      await redisClient.del(`user_for_manager_${user._id}`);

      if (user.hostel) {
        await clearCacheByPattern(`hostel_${user.hostel}*`);
      }
      if (user.curr_subscribed_mess) {
        await clearCacheByPattern(`hostel_${user.curr_subscribed_mess}*`);
      }

      return res.status(200).json({ message: "Profile saved", user });
    }

    return res.status(400).json({ message: "No valid fields provided" });
  } catch (err) {
    logger.error("saveUserProfile error", { error: err });
    return res
      .status(500)
      .json({ message: "Failed to save profile", error: String(err) });
  }
};

export const getUserComplaints = async (req, res) => {
  const { outlook } = req.params;
  try {
    const user = await User.findOne(
      { outlookID: outlook },
      "complaints",
    ).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user complaints" });
  }
};

// const getEmailsOfHABUsers = async (req, res) => {
//     try {
//         const emails = await User.find({ role: 'hab' }, 'email');

//         if (emails.length === 0) {
//             return res.status(404).json({ message: 'Emails not found'});
//         }
//         res.status(200).json(emails);
//     } catch (err) {
//         logger.error("Operation failed", { error: err });
//         res.status(500).json({ message: 'Error fetching emails'} );
//     }
// };

// const getEmailsOfSecyUsers = async (req, res) => {
//     try {
//         const emails = await User.find({ role: 'welfare_secy' }, 'email');

//         if (emails.length === 0) {
//             return res.status(404).json({ message: 'Emails not found'});
//         }
//         res.status(200).json(emails);
//     } catch (err) {
//         logger.error("Operation failed", { error: err });
//         res.status(500).json({ message: 'Error fetching emails'} );
//     }
// };

export const getAllUsers = async (req, res) => {
  try {
    const cacheKey = "all_users";
    const cachedUsers = await redisClient.get(cacheKey);
    if (cachedUsers) {
      return res.status(200).json(JSON.parse(cachedUsers));
    }

    const users = await User.find()
      .populate("hostel", "hostel_name")
      .populate(populateCurrSubscribedMess)
      .lean();

    const updatedUsers = users.map((user) => ({
      ...user,
      hostel_name: user.hostel?.hostel_name || null,
      curr_subscribed_mess_name: subscribedMessDisplayName(
        user.curr_subscribed_mess,
      ),
    }));

    await redisClient.set(
      cacheKey,
      JSON.stringify(updatedUsers),
      "EX",
      3600 * 24,
    );
    res.status(200).json(updatedUsers);
  } catch (err) {
    logger.error("Operation failed", { error: err });
    res.status(500).json({ message: "Error fetching users" });
  }
};

export const getUserCount = async (req, res) => {
  try {
    const cacheKey = "user_count";
    const cachedCount = await redisClient.get(cacheKey);
    if (cachedCount) {
      return res.status(200).json({ count: parseInt(cachedCount, 10) });
    }

    const count = await User.countDocuments();
    await redisClient.set(cacheKey, count.toString(), "EX", 3600 * 24);

    return res.status(200).json({ count });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    return res.status(500).json({ message: "Error fetching user count" });
  }
};

// Mess-manager (HABit HQ): get basic user profile by ID, restricted to users
// whose curr_subscribed_mess matches the manager's hostel (hostel _id).
export const getUserForManager = async (req, res, next) => {
  try {
    const managerHostel = req.managerHostel;
    const { userId } = req.params;

    if (!managerHostel || !managerHostel._id) {
      return res.status(400).json({ message: "Manager hostel not found" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const hostelId = managerHostel._id.toString();

    const cacheKey = `user_for_manager_${userId}`;
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return res.status(200).json(JSON.parse(cachedUser));
    }

    const user = await User.findById(userId)
      .select(
        "name rollNumber email roomNumber phoneNumber hostel curr_subscribed_mess",
      )
      .populate("hostel", "hostel_name")
      .populate(populateCurrSubscribedMess)
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const responsePayload = {
      _id: user._id,
      name: user.name,
      rollNumber: user.rollNumber,
      email: user.email,
      roomNumber: user.roomNumber || "",
      phoneNumber: user.phoneNumber || "",
      hostelName: user.hostel?.hostel_name || "",
      messName: subscribedMessDisplayName(user.curr_subscribed_mess) || "",
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify(responsePayload),
      "EX",
      3600,
    );
    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error("getUserForManager error:", { error: err });
    return next(new AppError(500, "Failed to fetch user profile"));
  }
};

export const getUsersByHostelForMess = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!hostelId) {
      return res.status(400).json({ message: "Hostel ID is required" });
    }

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Query users who are currently subscribed to this mess (curr_subscribed_mess equals hostelId)
    const query = { curr_subscribed_mess: hostelId };

    // Fire count and fetch operations in parallel
    const [totalCount, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .populate("hostel", "hostel_name")
        .populate(populateCurrSubscribedMess)
        .select("name rollNumber email hostel curr_subscribed_mess")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    logger.info("Hostel users loaded");

    res.status(200).json({
      message: "Users fetched successfully",
      count: totalCount,
      users: users,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
      hasPrevPage: pageNum > 1,
    });
  } catch (err) {
    logger.error("Operation failed", { error: err });
    res.status(500).json({ message: "Error fetching users by hostel" });
  }
};

function kolkataNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
}

function getTodayWindowKolkata() {
  const now = kolkataNow();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { todayStart, tomorrowStart };
}

/**
 * Mess-manager (HABit HQ): list subscribers for manager's hostel (curr_subscribed_mess),
 * with today's scan status + whether they're on leave today.
 *
 * GET /api/users/manager/subscribers?q=&page=&limit=
 */
export const listManagerSubscribers = async (req, res) => {
  try {
    const managerHostel = req.managerHostel;
    if (!managerHostel || !managerHostel._id || !managerHostel.messId) {
      return res.status(400).json({ message: "Manager hostel not found" });
    }

    const hostelId = managerHostel._id.toString();
    const messId =
      managerHostel.messId._id?.toString() || managerHostel.messId.toString();

    const q = (req.query?.q || "").toString().trim();
    const pageNum = Math.max(1, parseInt(req.query?.page || "1", 10) || 1);
    // Allow fetching full subscriber set via pagination; keep a high server-side cap to avoid accidental huge responses.
    const limitNum = Math.min(
      1000,
      Math.max(10, parseInt(req.query?.limit || "50", 10) || 50),
    );
    const skip = (pageNum - 1) * limitNum;

    const query = { curr_subscribed_mess: hostelId };
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      query.$or = [{ name: regex }, { rollNumber: regex }];
    }

    const [totalCount, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("name rollNumber")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const today = getCurrentDate(); // YYYY-MM-DD (Kolkata)
    const userIds = users.map((u) => u._id);

    const { todayStart, tomorrowStart } = getTodayWindowKolkata();

    const [scanLogs, leaves] = await Promise.all([
      ScanLogs.find({
        date: today,
        messId,
        userId: { $in: userIds },
      })
        .select("userId breakfast lunch dinner")
        .lean(),
      Leave.find({
        messHostel: hostelId,
        user: { $in: userIds },
        status: { $in: ["Pending", "Acknowledged", "Processed"] },
        startDate: { $lt: tomorrowStart },
        endDate: { $gte: todayStart },
      })
        .select("user status leaveType startDate endDate")
        .lean(),
    ]);

    const scanByUser = new Map();
    for (const l of scanLogs) {
      scanByUser.set(String(l.userId), {
        breakfast: l.breakfast === true,
        lunch: l.lunch === true,
        dinner: l.dinner === true,
      });
    }

    const leaveByUser = new Map();
    for (const l of leaves) {
      const key = String(l.user);
      if (!leaveByUser.has(key)) {
        leaveByUser.set(key, {
          status: l.status,
          leaveType: l.leaveType,
          startDate: l.startDate,
          endDate: l.endDate,
        });
      }
    }

    const result = users.map((u) => {
      const id = String(u._id);
      const scanned = scanByUser.get(id) || {
        breakfast: false,
        lunch: false,
        dinner: false,
      };
      const leave = leaveByUser.get(id) || null;
      return {
        _id: u._id,
        name: u.name,
        rollNumber: u.rollNumber,
        scanned,
        onLeaveToday: Boolean(leave),
        leave,
      };
    });

    return res.status(200).json({
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      today,
      users: result,
    });
  } catch (err) {
    logger.error("listManagerSubscribers:", { error: err });
    return res.status(500).json({ message: "Error fetching subscribers" });
  }
};

/**
 * Mess-manager (HABit HQ): today's status for one subscriber.
 * GET /api/users/manager/subscribers/:userId/status
 */
export const getManagerSubscriberTodayStatus = async (req, res) => {
  try {
    const managerHostel = req.managerHostel;
    const { userId } = req.params;
    if (!managerHostel || !managerHostel._id || !managerHostel.messId) {
      return res.status(400).json({ message: "Manager hostel not found" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const hostelId = managerHostel._id.toString();
    const messId =
      managerHostel.messId._id?.toString() || managerHostel.messId.toString();
    const today = getCurrentDate();

    const user = await User.findById(userId)
      .select("name rollNumber curr_subscribed_mess")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (
      !user.curr_subscribed_mess ||
      String(user.curr_subscribed_mess) !== hostelId
    ) {
      return res.status(403).json({ message: "User not in manager hostel" });
    }

    const scan = await ScanLogs.findOne({
      userId,
      messId,
      date: today,
    })
      .select("breakfast lunch dinner breakfastTime lunchTime dinnerTime")
      .lean();

    const scanned = {
      breakfast: scan?.breakfast === true,
      lunch: scan?.lunch === true,
      dinner: scan?.dinner === true,
    };

    const { todayStart, tomorrowStart } = getTodayWindowKolkata();
    const leave = await Leave.findOne({
      messHostel: hostelId,
      user: userId,
      status: { $in: ["Pending", "Acknowledged", "Processed"] },
      startDate: { $lt: tomorrowStart },
      endDate: { $gte: todayStart },
    })
      .select("status leaveType startDate endDate")
      .lean();

    return res.status(200).json({
      today,
      user: { _id: user._id, name: user.name, rollNumber: user.rollNumber },
      scanned,
      scanTimes: {
        breakfastTime: scan?.breakfastTime || null,
        lunchTime: scan?.lunchTime || null,
        dinnerTime: scan?.dinnerTime || null,
      },
      onLeaveToday: Boolean(leave),
      leave: leave || null,
    });
  } catch (err) {
    logger.error("getManagerSubscriberTodayStatus:", { error: err });
    return res.status(500).json({ message: "Error fetching status" });
  }
};

// Delete user account (hard delete after anonymization)
export const deleteUserAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    // Check for pending mess change applications
    const hasPendingMessChange =
      user.applied_for_mess_changed && !user.got_mess_changed;

    if (hasPendingMessChange) {
      return next(
        new AppError(
          400,
          "Cannot delete account with pending mess change application. Please wait for processing or contact admin to cancel.",
        ),
      );
    }

    // Check if user is SMC member
    if (user.isSMC === true) {
      return next(
        new AppError(
          403,
          "SMC members cannot delete their accounts. Please contact admin.",
        ),
      );
    }

    // Anonymized user ID for references
    const ANONYMIZED_USER_ID = new mongoose.Types.ObjectId(
      "000000000000000000000000",
    );

    // Start transaction for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. FCM Tokens - DELETE (no historical value)
      await FCMToken.deleteMany({ user: userId }, { session });

      // 2. Menu Item Likes - Remove user from likes arrays
      await MenuItem.updateMany(
        { likes: userId },
        { $pull: { likes: userId } },
        { session },
      );

      // 3. Feedback - Anonymize user reference only (keep feedback content unchanged)
      await Feedback.updateMany(
        { user: userId },
        { $set: { user: ANONYMIZED_USER_ID } },
        { session },
      );

      // 4. Scan Logs - Anonymize (keep historical scan data)
      await ScanLogs.updateMany(
        { userId: userId },
        { $set: { userId: ANONYMIZED_USER_ID } },
        { session },
      );

      // 5. Update UserAllocHostel with user's final hostel and mess before deletion
      if (user.rollNumber && user.hostel && user.curr_subscribed_mess) {
        await UserAllocHostel.updateOne(
          { rollno: user.rollNumber },
          {
            $set: {
              hostel: user.hostel,
              current_subscribed_mess: user.curr_subscribed_mess,
            },
          },
          { session },
        );
      }

      // 6. Anonymize MessChange records (update userName)
      if (user.rollNumber) {
        await MessChange.updateMany(
          { rollNumber: user.rollNumber },
          { $set: { userName: "Deleted User" } },
          { session },
        );
      }

      // 8. Hard delete user account
      await User.findByIdAndDelete(userId, { session });

      // Commit transaction
      await session.commitTransaction();

      // Clear related cache data
      await redisClient.del("all_users");
      await redisClient.del("user_count");

      if (user.rollNumber) {
        await redisClient.del(`user_by_roll_${user.rollNumber}`);
      }
      if (userId) {
        await redisClient.del(`user_for_manager_${userId}`);
      }

      if (user.hostel) {
        await clearCacheByPattern(`hostel_${user.hostel}*`);
      }
      if (user.curr_subscribed_mess) {
        await clearCacheByPattern(`hostel_${user.curr_subscribed_mess}*`);
      }

      return res.status(200).json({
        success: true,
        message: "Account deleted successfully",
        note: "Your account has been deleted. Historical data has been anonymized for institutional records.",
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (err) {
    logger.error("Error deleting user account:", { error: err });
    return next(new AppError(500, "Account deletion failed"));
  }
};
