const { User } = require("../../user/userModel.js");
const { Hostel } = require("../../hostel/hostelModel.js");
const UserAllocHostel = require("../../hostel/hostelAllocModel.js");
const { MessChange } = require("../messChangeModel.js");
const { MessChangeSettings } = require("../messChangeSettingsModel.js");
const {
  sendNotificationMessage,
  sendNotificationToUser,
} = require("../../notification/notificationController.js");
const {
  initializeCapacityTracker,
  processUsersInIterations,
} = require("../utils/messChangeLogic.js");

// Helper Functions

/**
 * Reset all users back to hostel
 */
const resetAllUsersToHostel = async () => {
  const allocations = await UserAllocHostel.find({}).lean();
  if (!allocations.length) return;

  const bulkAllocOps = allocations.map((alloc) => ({
    updateOne: {
      filter: { _id: alloc._id },
      update: { $set: { current_subscribed_mess: alloc.hostel } },
    },
  }));
  if (bulkAllocOps.length > 0) {
    await UserAllocHostel.bulkWrite(bulkAllocOps);
  }

  const bulkUserOps = allocations.map((alloc) => ({
    updateOne: {
      filter: { rollNumber: alloc.rollno },
      update: {
        $set: {
          curr_subscribed_mess: alloc.hostel,
          got_mess_changed: false,
        },
      },
    },
  }));
  if (bulkUserOps.length > 0) {
    await User.bulkWrite(bulkUserOps);
  }
};

/**
 * Update accepted users
 */
const updateAcceptedUsers = async (acceptedUsers) => {
  for (const a of acceptedUsers) {
    const user = await User.findById(a.id);
    if (!user) continue;

    const [fromHostel, toHostel] = await Promise.all([
      Hostel.findById(a.fromHostelId),
      Hostel.findById(a.toHostelId),
    ]);

    user.next_mess = a.toHostelId; // Staged for 1st of next month
    user.applied_for_mess_changed = false;
    user.applied_hostel_string = "";
    user.next_mess1 = null;
    user.next_mess2 = null;
    user.next_mess3 = null;
    user.applied_hostel_timestamp = null;
    await user.save();

    await MessChange.findOneAndUpdate(
      { rollNumber: user.rollNumber },
      {
        userName: user.name,
        rollNumber: user.rollNumber,
        fromHostel: fromHostel?.hostel_name || "Unknown",
        toHostel: toHostel?.hostel_name || "Unknown",
        toHostel1: toHostel?.hostel_name || "Unknown",
      },
      { upsert: true },
    );

    try {
      await sendNotificationToUser(
        user._id,
        "Mess Change Accepted",
        `Mess changed to ${toHostel?.hostel_name}. Applicable from next month.`,
      );
    } catch {}
  }
};

/**
 * Update rejected users
 */
const updateRejectedUsers = async (rejectedUsers) => {
  for (const r of rejectedUsers) {
    const user = await User.findById(r.id);
    if (!user) continue;

    user.applied_for_mess_changed = false;
    user.applied_hostel_string = "";
    user.next_mess = null;
    user.next_mess1 = null;
    user.next_mess2 = null;
    user.next_mess3 = null;
    await user.save();

    try {
      await sendNotificationToUser(
        user._id,
        "Mess Change Rejected",
        "Your mess change request was not approved this cycle.",
      );
    } catch {}
  }
};

/**
 * Update last processed timestamp
 */
const updateLastProcessedTimestamp = async () => {
  let settings = await MessChangeSettings.findOne();
  if (!settings) settings = new MessChangeSettings();

  settings.isEnabled = false;
  settings.lastProcessedAt = new Date();
  settings.disabledAt = new Date();
  await settings.save();
};

// Controllers

const processAllMessChangeRequests = async (req, res) => {
  try {
    const users = await User.find({ applied_for_mess_changed: true });
    if (!users.length) {
      return res.status(400).json({ message: "No mess change requests found" });
    }

    const hostels = await Hostel.find({});
    const capacityTracker = await initializeCapacityTracker(hostels);

    const { acceptedUsers, rejectedUsers } = await processUsersInIterations(
      users,
      capacityTracker,
    );

    await updateAcceptedUsers(acceptedUsers);
    await updateRejectedUsers(rejectedUsers);
    await updateLastProcessedTimestamp();

    sendNotificationMessage(
      "MESS CHANGE",
      "Mess Change is Disabled",
      "All_Hostels",
      { redirectType: "mess_change", isAlert: "true" },
    ).catch((err) =>
      console.error("Mess change disabled notification failed:", err),
    );

    res.status(200).json({
      message: `${acceptedUsers.length} accepted, ${rejectedUsers.length} rejected`,
      acceptedUsers,
      rejectedUsers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const rejectAllMessChangeRequests = async (req, res) => {
  try {
    const users = await User.find({ applied_for_mess_changed: true });
    if (!users.length) {
      return res
        .status(400)
        .json({ message: "No pending mess change requests found" });
    }

    for (const user of users) {
      user.applied_for_mess_changed = false;
      user.applied_hostel_string = "";
      user.next_mess = null;
      user.next_mess1 = null;
      user.next_mess2 = null;
      user.next_mess3 = null;
      await user.save();
    }

    await updateLastProcessedTimestamp();

    sendNotificationMessage(
      "MESS CHANGE",
      "Mess Change is Disabled",
      "All_Hostels",
      { redirectType: "mess_change", isAlert: "true" },
    ).catch((err) =>
      console.error("Mess change disabled notification failed:", err),
    );

    res.status(200).json({
      message: `Rejected ${users.length} pending requests. Mess change has been automatically disabled.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  processAllMessChangeRequests,
  rejectAllMessChangeRequests,
  resetAllUsersToHostel,
  updateLastProcessedTimestamp,
};
