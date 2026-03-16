const { User } = require("../../user/userModel.js");
const { Hostel } = require("../../hostel/hostelModel.js");
const { MessChangeSettings } = require("../messChangeSettingsModel.js");

/**
 * User submits a mess change request with preferences
 */
const messChangeRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);  //Cannot change to .lean()
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const settings = await MessChangeSettings.findOne().lean();
    if (!settings || !settings.isEnabled) {
      return res.status(403).json({
        message: "Mess change is currently disabled. Please contact HAB admin.",
      });
    }

    // Check if user is SMC member
    if (user.isSMC) {
      return res.status(403).json({
        message: "SMC members are not allowed to apply for mess change",
      });
    }

    const { mess_pref_1, mess_pref_2, mess_pref_3 } = req.body || {};

    if (!mess_pref_1) {
      return res.status(400).json({ message: "First preference is required" });
    }

    const resolveHostel = async (name) => {
      if (!name || typeof name !== "string" || !name.trim()) return null;
      return Hostel.findOne({ hostel_name: name.trim() }).lean();
    };

    const [h1, h2, h3] = await Promise.all([
      resolveHostel(mess_pref_1),
      resolveHostel(mess_pref_2),
      resolveHostel(mess_pref_3),
    ]);

    if (!h1) {
      return res
        .status(404)
        .json({ message: "First preference hostel not found" });
    }

    const ids = [
      h1?._id?.toString(),
      h2?._id?.toString(),
      h3?._id?.toString(),
    ].filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ message: "Preferences must be unique" });
    }

    // Check against current hostel instead of current mess
    const currentHostelId = user.hostel?.toString();
    if (!currentHostelId) {
      return res.status(400).json({
        message: "User hostel not assigned",
      });
    }

    if (ids.includes(currentHostelId)) {
      return res.status(400).json({
        message: "Please select hostels different from your current hostel",
      });
    }

    user.applied_for_mess_changed = true;
    user.applied_hostel_string = mess_pref_1;
    user.applied_hostel_timestamp = Date.now();
    user.next_mess1 = h1?._id || null;
    user.next_mess2 = h2?._id || null;
    user.next_mess3 = h3?._id || null;
    await user.save();

    return res.status(200).json({ message: "Request Sent" });
  } catch (e) {
    console.log(`Error: ${e}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * User gets their mess change status
 */
const messChangeStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const settings = await MessChangeSettings.findOne().lean();
    const isMessChangeEnabled = settings ? settings.isEnabled : false;

    // Resolve preference names
    const [h1, h2, h3] = await Promise.all([
      user.next_mess1 ? Hostel.findById(user.next_mess1) : null,
      user.next_mess2 ? Hostel.findById(user.next_mess2) : null,
      user.next_mess3 ? Hostel.findById(user.next_mess3) : null,
    ]);

    const prefNames = {
      first: h1 ? h1.hostel_name : null,
      second: h2 ? h2.hostel_name : null,
      third: h3 ? h3.hostel_name : null,
    };

    return res.status(200).json({
      message: "User mess change status fetched successfully",
      applied: user.applied_for_mess_changed || false,
      hostel: user.applied_hostel_string || "",
      default: user.hostel || "",
      isMessChangeEnabled,
      preferences: prefNames,
      appliedHostels: [
        prefNames.first,
        prefNames.second,
        prefNames.third,
      ].filter(Boolean),
    });
  } catch (err) {
    console.error("Error in messChangeStatus:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  messChangeRequest,
  messChangeStatus,
};
