const redisClient = require("../../utils/redisClient.js");
const bcrypt = require("bcrypt");
const { User } = require("../user/userModel.js");
const { Hostel } = require("./hostelModel.js");
const { Mess } = require("../mess/messModel.js");
const UserAllocHostel = require("./hostelAllocModel.js");
const { MessClosure } = require("./messClosureModel.js");
const { getCurrentDate } = require("../../utils/date.js");




const createHostel = async (req, res) => {
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
    console.log(err);
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
const setHostelPassword = async (req, res) => {
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
    console.log(err);
    return res.status(500).json({ message: "Error setting hostel password" });
  }
};

const getHostel = async (req, res) => {
  try {
    // Fetch the hostel with populated messId
    const cacheKey = `hostel_${req.hostel._id}`;
    const cachedHostel = await redisClient.get(cacheKey);
    if (cachedHostel) {
      return res.json({ hostel: JSON.parse(cachedHostel) });
    }
    const hostel = await Hostel.findById(req.hostel._id).populate("messId").lean();
    // Cache the hostel data for 1 hour
    await redisClient.set(cacheKey, JSON.stringify(hostel), 'EX', 3600);
    return res.json({ hostel });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

const getAllHostels = async (req, res) => {
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
      console.error("Redis get error:", redisErr);
    }

    // CRITICAL FIX: Exclude the password hash!
    const hostels = await Hostel.find().select("-managerPasswordHash").lean();

    try {
      if (redisClient) await redisClient.set(cacheKey, JSON.stringify(hostels), 'EX', 3600);
    } catch (redisErr) {
      console.error("Redis set error:", redisErr);
    }

    return res.status(200).json(hostels);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

const getAllHostelsWithMess = async (req, res) => {
  try {
    const cacheKey = "all_hostels_with_mess";

    try {
      if (redisClient) {
        const cachedHostels = await redisClient.get(cacheKey);
        if (cachedHostels) return res.json({ hostels: JSON.parse(cachedHostels) });
      }
    } catch (redisErr) {
      console.error("Redis get error:", redisErr);
    }

    // CRITICAL FIX: Exclude the password hash!
    const hostels = await Hostel.find().populate("messId").select("-managerPasswordHash").lean();

    try {
      if (redisClient) await redisClient.set(cacheKey, JSON.stringify(hostels), 'EX', 3600);
    } catch (redisErr) {
      console.error("Redis set error:", redisErr);
    }

    return res.status(200).json(hostels);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

const getHostelbyId = async (req, res) => {
  const { hostelId } = req.params;
  try {
    // Safe pagination parsing to prevent NaN or negative skip values
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    
    page = (!isNaN(page) && page > 0) ? page : 1;
    limit = (!isNaN(limit) && limit > 0) ? limit : 50;
    
    const skip = (page - 1) * limit;

    const cacheKey = `hostel_by_id_${hostelId}_pg${page}_limit${limit}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ message: "Hostel found", hostel: JSON.parse(cachedData) });
    }

    const usersQuery = User.find({ hostel: hostelId })
      .select("name rollNumber email roomNumber phoneNumber degree curr_subscribed_mess")
      .populate("curr_subscribed_mess", "hostel_name")
      .sort({ rollNumber: 1 });

    if (limit > 0) {
      usersQuery.skip(skip).limit(limit);
    }

    const [hostel, users, totalUsersCount] = await Promise.all([
      Hostel.findById(hostelId).populate("messId", "name").lean(),
      usersQuery.lean(),
      User.countDocuments({ hostel: hostelId })
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
        curr_subscribed_mess_name: user.curr_subscribed_mess?.hostel_name || "N/A",
      },
    }));
    const hostelWithUsers = {
      ...hostel,
      totalUsersCount,
      users: formattedUsers,
    };

    await redisClient.set(cacheKey, JSON.stringify(hostelWithUsers), 'EX', 3600);

    return res
      .status(200)
      .json({ message: "Hostel found", hostel: hostelWithUsers });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Hostel deletion endpoint removed. Deleting hostels from the system is disallowed per new policy.

const getAllHostelNameAndCaterer = async (req, res) => {
  try {
    const cacheKey = "hostel_name_and_caterer";
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const hostelData = await Hostel.find(
      {},
      { hostel_name: 1, messId: 1 },
    ).populate({
      path: "messId",
      select: "name -_id",
    }).lean();

    // Use aggregation to group and count users per hostel in a single query
    const userCounts = await User.aggregate([
      { $group: { _id: "$hostel", count: { $sum: 1 } } }
    ]);

    // Create a map for quick O(1) lookups in memory
    const countMap = {};
    userCounts.forEach(item => {
      if (item._id) {
        countMap[item._id.toString()] = item.count;
      }
    });

    const hostelDataWithUserCount = hostelData.map(hostel => ({
      ...hostel,
      user_count: countMap[hostel._id.toString()] || 0,
    }));

    await redisClient.set(cacheKey, JSON.stringify(hostelDataWithUserCount), 'EX', 3600);

    res.status(200).json(hostelDataWithUserCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get caterer info for the logged-in hostel
const getCatererInfo = async (req, res) => {
  try {
    const cacheKey = `hostel_${req.hostel._id}_caterer_info`;
    const cachedInfo = await redisClient.get(cacheKey);
    if (cachedInfo) {
      return res.json(JSON.parse(cachedInfo));
    }
    const hostel = await Hostel.findById(req.hostel._id).populate("messId").lean();
    if (!hostel || !hostel.messId) {
      return res
        .status(404)
        .json({ message: "Caterer not assigned to this hostel" });
    }

    const mess = hostel.messId;
    const responsePayload = {
      messId: mess._id,
      catererName: mess.name,
      hostelName: hostel.hostel_name,
    };
    await redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get boarders (users in this hostel) with room numbers
const getBoarders = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    // Safe pagination parsing to prevent NaN or negative skip values
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    
    page = (!isNaN(page) && page > 0) ? page : 1;
    limit = (!isNaN(limit) && limit > 0) ? limit : 50;
    
    const skip = (page - 1) * limit;

    const cacheKey = `hostel_${hostelId}_boarders_pg${page}_limit${limit}`;
    const cachedBoarders = await redisClient.get(cacheKey);
    if (cachedBoarders) {
      return res.status(200).json(JSON.parse(cachedBoarders));
    }

    const boardersQuery = User.find({ hostel: hostelId })
      .select("name rollNumber email roomNumber phoneNumber degree")
      .sort({ rollNumber: 1 });

    if (limit > 0) {
      boardersQuery.skip(skip).limit(limit);
    }

    const [boarders, totalCount] = await Promise.all([
      boardersQuery.lean(),
      User.countDocuments({ hostel: hostelId })
    ]);

    const responsePayload = {
      count: boarders.length,
      totalCount: totalCount,
      boarders: boarders.map((b) => ({
        _id: b._id,
        name: b.name,
        rollNumber: b.rollNumber,
        email: b.email,
        phoneNumber: b.phoneNumber || "N/A",
        roomNumber: b.roomNumber || "N/A",
        degree: b.degree || "N/A",
      })),
    };

    await redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Helper function to format and sort mess subscribers
const formatMessSubscribers = (subscribers, hostelId) => {
  const subscribersList = subscribers.map((sub) => {
    const isDifferentHostel =
      sub.hostel && sub.hostel._id.toString() !== hostelId.toString();

    return {
      _id: sub._id,
      name: sub.name,
      rollNumber: sub.rollNumber,
      email: sub.email,
      phoneNumber: sub.phoneNumber || "N/A",
      roomNumber: sub.roomNumber || "N/A",
      currentHostel: sub.hostel ? sub.hostel.hostel_name : "N/A",
      currentSubscribedMess: sub.curr_subscribed_mess
        ? sub.curr_subscribed_mess.hostel_name
        : "N/A",
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

// Get mess subscribers with their current hostel (highlight if different)
const getMessSubscribers = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    // Safe pagination parsing to prevent NaN or negative skip values
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    
    page = (!isNaN(page) && page > 0) ? page : 1;
    limit = (!isNaN(limit) && limit > 0) ? limit : 50;
    
    const skip = (page - 1) * limit;

    const cacheKey = `hostel_${hostelId}_mess_subscribers_pg${page}_limit${limit}`;
    const cachedSubscribers = await redisClient.get(cacheKey);
    if (cachedSubscribers) {
      return res.status(200).json(JSON.parse(cachedSubscribers));
    }

    // Find all users subscribed to this hostel's mess
    const subscribersQuery = User.find({ curr_subscribed_mess: hostelId })
      .select(
        "name rollNumber email roomNumber phoneNumber hostel curr_subscribed_mess",
      )
      .populate("hostel", "hostel_name")
      .populate("curr_subscribed_mess", "hostel_name")
      .sort({ rollNumber: 1 });

    if (limit > 0) {
      subscribersQuery.skip(skip).limit(limit);
    }

    const [subscribers, totalCount] = await Promise.all([
      subscribersQuery.lean(),
      User.countDocuments({ curr_subscribed_mess: hostelId })
    ]);

    const subscribersList = formatMessSubscribers(subscribers, hostelId);

    const responsePayload = {
      count: subscribersList.length,
      totalCount: totalCount,
      subscribers: subscribersList,
    };

    await redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Public variant: get mess subscribers by hostelId param
const getMessSubscribersByHostelId = async (req, res) => {
  try {
    const { hostelId } = req.params;
    if (!hostelId) {
      return res.status(400).json({ message: "Hostel ID is required" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const cacheKey = `hostel_${hostelId}_mess_subscribers_public_pg${page}_limit${limit}`;
    const cachedSubscribers = await redisClient.get(cacheKey);
    if (cachedSubscribers) {
      return res.status(200).json(JSON.parse(cachedSubscribers));
    }

    const subscribersQuery = User.find({ curr_subscribed_mess: hostelId })
      .select(
        "name rollNumber email roomNumber phoneNumber hostel curr_subscribed_mess",
      )
      .populate("hostel", "hostel_name")
      .populate("curr_subscribed_mess", "hostel_name")
      .sort({ rollNumber: 1 });

    if (limit > 0) {
      subscribersQuery.skip(skip).limit(limit);
    }

    const [subscribers, totalCount] = await Promise.all([
      subscribersQuery.lean(),
      User.countDocuments({ curr_subscribed_mess: hostelId })
    ]);

    const subscribersList = formatMessSubscribers(subscribers, hostelId);

    const responsePayload = {
      count: subscribersList.length,
      totalCount: totalCount,
      subscribers: subscribersList,
    };

    await redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Mark user as SMC member
const markAsSMC = async (req, res) => {
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
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Unmark user as SMC member
const unmarkAsSMC = async (req, res) => {
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
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get SMC members for this hostel
const getSMCMembers = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const cacheKey = `hostel_${hostelId}_smc_members`;

    try {
      if (redisClient) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (redisErr) {
      console.error("Redis error:", redisErr);
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
      if (redisClient) await redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    } catch (redisErr) {
      console.error("Redis error:", redisErr);
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Set the closure date for the current month
const finalizeMessClosure = async (req, res) => {
  try {
    const { date } = req.body; // Expecting YYYY-MM-DD
    const hostelId = req.hostel._id;

    const selectedDate = new Date(date);
    const month = selectedDate.getMonth() + 1;
    const year = selectedDate.getFullYear();

    // Upsert: Update if exists for this month, else create
    const closure = await MessClosure.findOneAndUpdate(
      { hostelId, month, year },
      { hostelId, closureDate: new Date(date), month, year },
      { upsert: true, new: true },
    );

    // Invalidate this month's closure date cache
    await redisClient.del(`hostel_${hostelId}_closure_date_${month}_${year}`);

    return res.status(200).json({
      message: "Mess closure date finalized successfully",
      closure,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error finalizing closure" });
  }
};

// Get the current closure date for the hostel
const getMessClosureDate = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const officialDate = new Date(getCurrentDate());
    const currentMonth = officialDate.getMonth() + 1;
    const currentYear = officialDate.getFullYear();

    const closure = await MessClosure.findOne({
      hostelId,
      month: currentMonth,
      year: currentYear,
    });

    return res
      .status(200)
      .json({ closureDate: closure ? closure.closureDate : null });
  } catch (err) {
    return res.status(500).json({ message: "Error fetching closure date" });
  }
};

module.exports = {
  createHostel,
  getHostel,
  getAllHostels,
  getAllHostelsWithMess,
  getHostelbyId,
  getAllHostelNameAndCaterer,
  getCatererInfo,
  getBoarders,
  getMessSubscribers,
  getMessSubscribersByHostelId,
  markAsSMC,
  unmarkAsSMC,
  getSMCMembers,
  finalizeMessClosure,
  getMessClosureDate,
  setHostelPassword,
};
