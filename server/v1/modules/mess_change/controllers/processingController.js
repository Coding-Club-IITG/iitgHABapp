const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const backupDir = path.join(__dirname, "../../../../backup");

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
const {
  generateMessChangeReport,
} = require("../utils/messChangeReportGenerator.js");
const {
  uploadReportToOnedrive,
} = require("../../../utils/onedriveController.js");
const { withTransaction } = require("../../../utils/withTransaction.js");

// Helper Functions

/**
 * Reset all users back to hostel
 */
const resetAllUsersToHostel = async (session = null) => {
  const opts = session ? { session } : {};

  const allocations = await UserAllocHostel.find({})
    .lean()
    .session(session || undefined);
  if (!allocations.length) return;

  const bulkAllocOps = allocations.map((alloc) => ({
    updateOne: {
      filter: { _id: alloc._id },
      update: { $set: { current_subscribed_mess: alloc.hostel } },
    },
  }));
  await UserAllocHostel.bulkWrite(bulkAllocOps, opts);

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
  await User.bulkWrite(bulkUserOps, opts);
};

/**
 * Update accepted users
 */
const updateAcceptedUsers = async (acceptedUsers, users, hostels, session) => {
  if (!acceptedUsers.length) return;

  const hostelMap = hostels.reduce((acc, h) => {
    acc[h._id.toString()] = h.hostel_name;
    return acc;
  }, {});

  const userOps = [];
  const messChangeOps = [];

  for (const a of acceptedUsers) {
    const user = users.find((u) => u._id.toString() === a.id);
    if (!user) continue;

    userOps.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            next_mess: a.toHostelId,
            applied_for_mess_changed: false,
            applied_hostel_string: "",
            next_mess1: null,
            next_mess2: null,
            next_mess3: null,
            applied_hostel_timestamp: null,
          },
        },
      },
    });

    const fromHostelName = hostelMap[a.fromHostelId?.toString()] || "Unknown";
    const toHostelName = hostelMap[a.toHostelId?.toString()] || "Unknown";

    messChangeOps.push({
      updateOne: {
        filter: { rollNumber: user.rollNumber },
        update: {
          $set: {
            userName: user.name,
            rollNumber: user.rollNumber,
            fromHostel: fromHostelName,
            toHostel: toHostelName,
            toHostel1: toHostelName,
          },
        },
        upsert: true,
      },
    });
  }

  const opts = { session };
  if (userOps.length > 0) await User.bulkWrite(userOps, opts);
  if (messChangeOps.length > 0) await MessChange.bulkWrite(messChangeOps, opts);
};

/**
 * Update rejected users
 */
const updateRejectedUsers = async (rejectedUsers, users, session) => {
  if (!rejectedUsers.length) return;

  const userOps = rejectedUsers
    .map((r) => {
      const user = users.find((u) => u._id.toString() === r.id);
      if (!user) return null;
      return {
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              applied_for_mess_changed: false,
              applied_hostel_string: "",
              next_mess: null,
              next_mess1: null,
              next_mess2: null,
              next_mess3: null,
              applied_hostel_timestamp: null,
            },
          },
        },
      };
    })
    .filter(Boolean);

  if (userOps.length > 0) await User.bulkWrite(userOps, { session });
};

/**
 * Update last processed timestamp
 */
const updateLastProcessedTimestamp = async (session) => {
  let settings = await MessChangeSettings.findOne().session(session);
  if (!settings) settings = new MessChangeSettings();
  settings.isEnabled = false;
  settings.lastProcessedAt = new Date();
  settings.disabledAt = new Date();
  await settings.save({ session });
};

/**
 * Mess change flow
 */
const createBackup = (users, hostels) => {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const hostelMap = hostels.reduce((acc, h) => {
      acc[h._id.toString()] = h.hostel_name;
      return acc;
    }, {});

    const data = users.map((u) => ({
      "Roll Number": u.rollNumber || "",
      Name: u.name || "",
      "Boarding Hostel": hostelMap[u.hostel?.toString()] || "",
      "Curr Subscribed Mess":
        hostelMap[u.curr_subscribed_mess?.toString()] || "",
      "Next Mess 1": hostelMap[u.next_mess1?.toString()] || "",
      "Next Mess 2": hostelMap[u.next_mess2?.toString()] || "",
      "Next Mess 3": hostelMap[u.next_mess3?.toString()] || "",
      Timestamp: u.applied_hostel_timestamp
        ? new Date(u.applied_hostel_timestamp).toISOString()
        : "",
    }));

    const sheet = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, "Backup");

    const filename = `applications_backup_${Date.now()}.csv`;
    xlsx.writeFile(wb, path.join(backupDir, filename), { bookType: "csv" });
    console.log(`[MESS CHANGE] Created applications CSV backup: ${filename}`);
  } catch (err) {
    console.error("[MESS CHANGE] Error creating backup CSV:", err);
  }
};

const generateAndUploadReport = async (
  users,
  acceptedUsers,
  rejectedUsers,
  capacityTracker,
  hostels,
) => {
  try {
    const buffer = await generateMessChangeReport({
      users,
      acceptedUsers,
      rejectedUsers,
      capacityTracker,
      hostels,
    });

    const filename = `Mess_Change_Report_${Date.now()}.xlsx`;

    // Save locally
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const filePath = path.join(backupDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`[MESS CHANGE] Saved report locally: ${filename}`);

    const url = await uploadReportToOnedrive(buffer, filename);
    if (url) {
      console.log("[MESS CHANGE] Report uploaded to OneDrive:", url);
    }
  } catch (err) {
    console.error("[MESS CHANGE] Error generating/uploading report:", err);
  }
};

// Controllers

const processAllMessChangeRequests = async (req, res) => {
  try {
    const users = await User.find({ applied_for_mess_changed: true });

    if (!users.length) {
      return res
        ?.status(400)
        .json({ message: "No mess change requests found" });
    }

    const hostels = await Hostel.find({});

    createBackup(users, hostels);

    const capacityTracker = await initializeCapacityTracker(hostels);
    const { acceptedUsers, rejectedUsers } = await processUsersInIterations(
      users,
      capacityTracker,
    );

    // ATOMIC TRANSACTION
    await withTransaction(async (session) => {
      await updateAcceptedUsers(acceptedUsers, users, hostels, session);
      await updateRejectedUsers(rejectedUsers, users, session);
      await updateLastProcessedTimestamp(session);
    });

    generateAndUploadReport(
      users,
      acceptedUsers,
      rejectedUsers,
      capacityTracker,
      hostels,
    ).catch((err) =>
      console.error("[MESS CHANGE] Report generation failed:", err),
    );

    sendNotificationMessage(
      "MESS CHANGE",
      "Mess Change is Disabled",
      "All_Hostels",
      { redirectType: "mess_change", isAlert: "true" },
    ).catch((err) =>
      console.error("[MESS CHANGE] Disabled notification failed:", err),
    );

    // Per-user notifications after commit
    const hostelMap = hostels.reduce((acc, h) => {
      acc[h._id.toString()] = h.hostel_name;
      return acc;
    }, {});

    for (const a of acceptedUsers) {
      const toName = hostelMap[a.toHostelId?.toString()] || "new mess";
      sendNotificationToUser(
        a.id,
        "Mess Change Accepted",
        `Mess changed to ${toName}. Applicable from next month.`,
        "hab_mess_updates",
      ).catch(() => {});
    }
    for (const r of rejectedUsers) {
      sendNotificationToUser(
        r.id,
        "Mess Change Rejected",
        "Your mess change request was not approved this cycle.",
        "hab_mess_updates",
      ).catch(() => {});
    }

    if (res) {
      res.status(200).json({
        message: `${acceptedUsers.length} accepted, ${rejectedUsers.length} rejected`,
        acceptedUsers,
        rejectedUsers,
      });
    }
  } catch (err) {
    console.error("[MESS CHANGE] processAllMessChangeRequests failed:", err);
    if (res) res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  processAllMessChangeRequests,
  resetAllUsersToHostel,
  updateLastProcessedTimestamp,
};
