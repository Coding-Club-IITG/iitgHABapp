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
    const hostel = await Hostel.findById(req.hostel._id).populate("messId");
    return res.json({ hostel });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

const getAllHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find();
    return res.status(200).json(hostels);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occured" });
  }
};

const getAllHostelsWithMess = async (req, res) => {
  try {
    const hostels = await Hostel.find().populate("messId");
    return res.status(200).json(hostels);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

const getHostelbyId = async (req, res) => {
  const { hostelId } = req.params;
  try {
    const hostel = await Hostel.findById(hostelId).populate("messId", "name");

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    // Fetch users associated with this hostel (include phoneNumber & roomNumber)
    const users = await User.find({ hostel: hostelId }).select(
      "name rollNumber email roomNumber phoneNumber degree curr_subscribed_mess",
    );
    // Fetch all hostels with their mess information to map curr_subscribed_mess
    const hostelsWithMess = await Hostel.find().populate("messId", "name");
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
        curr_subscribed_mess_name: (() => {
          if (!user.curr_subscribed_mess) return "N/A";
          const subscribedHostel = hostelsWithMess.find(
            (h) => h._id.toString() === user.curr_subscribed_mess.toString(),
          );
          return subscribedHostel?.hostel_name || "N/A";
        })(),
      },
    }));
    const hostelWithUsers = {
      ...hostel.toObject(),
      users: formattedUsers,
    };

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
    const hostelData = await Hostel.find(
      {},
      { hostel_name: 1, messId: 1 },
    ).populate({
      path: "messId",
      select: "name -_id",
    });

    // Get user count for each hostel
    const hostelDataWithUserCount = await Promise.all(
      hostelData.map(async (hostel) => {
        const userCount = await User.countDocuments({ hostel: hostel._id });
        return {
          ...hostel.toObject(),
          user_count: userCount,
        };
      }),
    );

    res.status(200).json(hostelDataWithUserCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get caterer info for the logged-in hostel
const getCatererInfo = async (req, res) => {
  try {
    const hostel = await Hostel.findById(req.hostel._id).populate("messId");
    if (!hostel || !hostel.messId) {
      return res
        .status(404)
        .json({ message: "Caterer not assigned to this hostel" });
    }

    const mess = hostel.messId;
    return res.status(200).json({
      messId: mess._id,
      catererName: mess.name,
      hostelName: hostel.hostel_name,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get boarders (users in this hostel) with room numbers
const getBoarders = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const boarders = await User.find({ hostel: hostelId })
      .select("name rollNumber email roomNumber phoneNumber degree")
      .sort({ rollNumber: 1 });

    return res.status(200).json({
      count: boarders.length,
      boarders: boarders.map((b) => ({
        _id: b._id,
        name: b.name,
        rollNumber: b.rollNumber,
        email: b.email,
        phoneNumber: b.phoneNumber || "N/A",
        roomNumber: b.roomNumber || "N/A",
        degree: b.degree || "N/A",
      })),
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error occurred" });
  }
};

// Get mess subscribers with their current hostel (highlight if different)
const getMessSubscribers = async (req, res) => {
  try {
    const hostelId = req.hostel._id;

    // Find all users subscribed to this hostel's mess
    const subscribers = await User.find({ curr_subscribed_mess: hostelId })
      .select(
        "name rollNumber email roomNumber phoneNumber hostel curr_subscribed_mess",
      )
      .populate("hostel", "hostel_name")
      .populate("curr_subscribed_mess", "hostel_name");

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
      return a.rollNumber.localeCompare(b.rollNumber);
    });

    return res.status(200).json({
      count: subscribersList.length,
      subscribers: subscribersList,
    });
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

    const subscribers = await User.find({ curr_subscribed_mess: hostelId })
      .select(
        "name rollNumber email roomNumber phoneNumber hostel curr_subscribed_mess",
      )
      .populate("hostel", "hostel_name")
      .populate("curr_subscribed_mess", "hostel_name");

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

    subscribersList.sort((a, b) => {
      if (a.isDifferentHostel && !b.isDifferentHostel) return -1;
      if (!a.isDifferentHostel && b.isDifferentHostel) return 1;
      return a.rollNumber.localeCompare(b.rollNumber);
    });

    return res.status(200).json({
      count: subscribersList.length,
      subscribers: subscribersList,
    });
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

    const smcMembers = await User.find({
      hostel: hostelId,
      isSMC: true,
    })
      .select("name rollNumber email roomNumber degree")
      .sort({ rollNumber: 1 });

    return res.status(200).json({
      count: smcMembers.length,
      smcMembers: smcMembers.map((m) => ({
        _id: m._id,
        name: m.name,
        rollNumber: m.rollNumber,
        email: m.email,
        roomNumber: m.roomNumber || "N/A",
        degree: m.degree || "N/A",
      })),
    });
  } catch (err) {
    console.log(err);
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
