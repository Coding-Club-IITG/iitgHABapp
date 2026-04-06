const redisClient = require("../../utils/redisClient.js");
const { User } = require("./userModel.js");
const { Hostel } = require("../hostel/hostelModel.js");
const mongoose = require("mongoose");
const Feedback = require("../feedback/feedbackModel.js");
const { ScanLogs } = require("../mess/ScanLogsModel.js");
const FCMToken = require("../notification/FCMToken.js");
const Notification = require("../notification/notificationModel.js");
const { MenuItem } = require("../mess/menuItemModel.js");
const { MessChange } = require("../mess_change/messChangeModel.js");
const UserAllocHostel = require("../hostel/hostelAllocModel.js");
const AppError = require("../../utils/appError.js");
const { clearCacheByPattern } = require("../../utils/redisUtils.js");


const getUserData = async (req, res, next) => {
  if (req.user) {
    return res.json(req.user);
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

const getUserByRoll = async (req, res) => {
  const { qr } = req.params;

  try {
    const cacheKey = `user_by_roll_${qr}`;
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return res.status(200).json({ message: "User found", user: JSON.parse(cachedUser) });
    }

    const user = await User.findOne({ rollNumber: qr }).lean();

    if (!user) {
      return res.status(400).json({ message: "No such roll exists" });
    }

    await redisClient.set(cacheKey, JSON.stringify(user), 'EX', 3600);
    return res.status(200).json({ message: "User found", user: user });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occured" });
  }
};

const createUser = async (req, res) => {
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
    console.log(err);
  }
};

const deleteUser = async (req, res) => {
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
const updateUser = async (req, res) => {
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
    console.log(err);
    res.status(500).json({ message: "Error updating user" });
  }
};

// Update roomNumber and phoneNumber for the authenticated user
const saveUserProfile = async (req, res) => {
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
    console.error("saveUserProfile error", err);
    return res
      .status(500)
      .json({ message: "Failed to save profile", error: String(err) });
  }
};

const getUserComplaints = async (req, res) => {
  const { outlook } = req.params;
  try {
    const user = await User.findOne({ outlookID: outlook }, "complaints").lean();
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
//         console.log(err);
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
//         console.log(err);
//         res.status(500).json({ message: 'Error fetching emails'} );
//     }
// };

const getAllUsers = async (req, res) => {
  try {
    const cacheKey = "all_users";
    const cachedUsers = await redisClient.get(cacheKey);
    if (cachedUsers) {
      return res.status(200).json(JSON.parse(cachedUsers));
    }

    const users = await User.find()
      .populate("hostel", "hostel_name")
      .populate("curr_subscribed_mess", "hostel_name")
      .lean();

    const updatedUsers = users.map((user) => ({
      ...user,
      hostel_name: user.hostel?.hostel_name || null,
      curr_subscribed_mess_name: user.curr_subscribed_mess?.hostel_name || null,
    }));

    await redisClient.set(cacheKey, JSON.stringify(updatedUsers), 'EX', 3600 * 24);
    res.status(200).json(updatedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching users" });
  }
};

const getUserCount = async (req, res) => {
  try {
    const cacheKey = "user_count";
    const cachedCount = await redisClient.get(cacheKey);
    if (cachedCount) {
      return res.status(200).json({ count: parseInt(cachedCount, 10) });
    }

    const count = await User.countDocuments();
    await redisClient.set(cacheKey, count.toString(), 'EX', 3600 * 24);

    return res.status(200).json({ count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching user count" });
  }
};

// Mess-manager (HABit HQ): get basic user profile by ID, restricted to users
// whose curr_subscribed_mess matches the manager's hostel (hostel _id).
const getUserForManager = async (req, res, next) => {
  try {
    const managerHostel = req.managerHostel;
    const { userId } = req.params;

    if (!managerHostel || !managerHostel._id) {
      return res
        .status(400)
        .json({ message: "Manager hostel not found" });
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
      .populate("curr_subscribed_mess", "hostel_name")
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
      messName: user.curr_subscribed_mess?.hostel_name || "",
    };

    await redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("getUserForManager error:", err);
    return next(new AppError(500, "Failed to fetch user profile"));
  }
};

const getUsersByHostelForMess = async (req, res) => {
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
        .populate("curr_subscribed_mess", "hostel_name")
        .select("name rollNumber email hostel curr_subscribed_mess")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    console.log(`Found ${users.length} users for hostel ${hostelId}`);

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
    console.error(err);
    res.status(500).json({ message: "Error fetching users by hostel" });
  }
};

// Delete user account (hard delete after anonymization)
const deleteUserAccount = async (req, res, next) => {
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

      // 2. Notifications - Remove user from recipients and readBy
      await Notification.updateMany(
        { recipients: userId },
        { $pull: { recipients: userId } },
        { session },
      );
      await Notification.updateMany(
        { readBy: userId },
        { $pull: { readBy: userId } },
        { session },
      );

      // 3. Menu Item Likes - Remove user from likes arrays
      await MenuItem.updateMany(
        { likes: userId },
        { $pull: { likes: userId } },
        { session },
      );

      // 4. Feedback - Anonymize user reference only (keep feedback content unchanged)
      await Feedback.updateMany(
        { user: userId },
        { $set: { user: ANONYMIZED_USER_ID } },
        { session },
      );

      // 5. Scan Logs - Anonymize (keep historical scan data)
      await ScanLogs.updateMany(
        { userId: userId },
        { $set: { userId: ANONYMIZED_USER_ID } },
        { session },
      );

      // 6. Update UserAllocHostel with user's final hostel and mess before deletion
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

      // 7. Anonymize MessChange records (update userName)
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
    console.error("Error deleting user account:", err);
    return next(new AppError(500, "Account deletion failed"));
  }
};

module.exports = {
  getUserData,
  createUser,
  deleteUser,
  updateUser,
  saveUserProfile,
  // getEmailsOfHABUsers,
  // getEmailsOfSecyUsers,
  getUserComplaints,
  getUserByRoll,
  getAllUsers,
  getUserCount,
  getUsersByHostelForMess,
  deleteUserAccount,
  getUserForManager,
};
