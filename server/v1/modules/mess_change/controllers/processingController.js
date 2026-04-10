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

const { uploadReportToOnedrive } = require("../../../utils/onedrive.js");

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
const updateAcceptedUsers = async (acceptedUsers, users, hostels) => {
  const userOps = [];
  const messChangeOps = [];

  const hostelMap = hostels.reduce((acc, h) => {
    acc[h._id.toString()] = h.hostel_name;
    return acc;
  }, {});

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

    sendNotificationToUser(
      user._id,
      "Mess Change Accepted",
      `Mess changed to ${toHostelName}. Applicable from next month.`,
    ).catch(() => {});
  }

  if (userOps.length > 0) {
    await User.bulkWrite(userOps);
  }
  if (messChangeOps.length > 0) {
    await MessChange.bulkWrite(messChangeOps);
  }
};

/**
 * Update rejected users
 */
const updateRejectedUsers = async (rejectedUsers, users) => {
  const userOps = [];
  for (const r of rejectedUsers) {
    const user = users.find((u) => u._id.toString() === r.id);
    if (!user) continue;

    userOps.push({
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
          },
        },
      },
    });

    sendNotificationToUser(
      user._id,
      "Mess Change Rejected",
      "Your mess change request was not approved this cycle.",
    ).catch(() => {});
  }

  if (userOps.length > 0) {
    await User.bulkWrite(userOps);
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
    console.log(`Created applications CSV backup: ${filename}`);
  } catch (err) {
    console.error("Error creating backup CSV:", err);
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
    const hostelMap = hostels.reduce((acc, h) => {
      acc[h._id.toString()] = h.hostel_name;
      return acc;
    }, {});

    const sortedUsers = [...users].sort(
      (a, b) =>
        new Date(a.applied_hostel_timestamp || 0) -
        new Date(b.applied_hostel_timestamp || 0),
    );
    const sortedAccepted = [...acceptedUsers].sort((a, b) => {
      const uA = users.find((u) => u._id.toString() === a.id);
      const uB = users.find((u) => u._id.toString() === b.id);
      return (
        new Date(uA?.applied_hostel_timestamp || 0) -
        new Date(uB?.applied_hostel_timestamp || 0)
      );
    });
    const sortedRejected = [...rejectedUsers].sort((a, b) => {
      const uA = users.find((u) => u._id.toString() === a.id);
      const uB = users.find((u) => u._id.toString() === b.id);
      return (
        new Date(uA?.applied_hostel_timestamp || 0) -
        new Date(uB?.applied_hostel_timestamp || 0)
      );
    });

    const sheet1Data = sortedUsers.map((u) => ({
      "Roll number": u.rollNumber || "",
      Name: u.name || "",
      "Boarding hostel": hostelMap[u.hostel?.toString()] || "Unknown",
      "Preference 1": hostelMap[u.next_mess1?.toString()] || "N/A",
      "Preference 2": hostelMap[u.next_mess2?.toString()] || "N/A",
      "Preference 3": hostelMap[u.next_mess3?.toString()] || "N/A",
      "Application Timestamp": u.applied_hostel_timestamp
        ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "",
    }));

    const sheet2Data = sortedAccepted.map((a) => {
      const u = users.find((user) => user._id.toString() === a.id);
      return {
        "Roll number": a.rollNumber || "",
        "Boarding hostel": hostelMap[a.fromHostelId?.toString()] || "Unknown",
        "New hostel": hostelMap[a.toHostelId?.toString()] || "Unknown",
        Timestamp: u?.applied_hostel_timestamp
          ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })
          : "",
      };
    });

    const sheet3Data = sortedRejected.map((r) => {
      const u = users.find((user) => user._id.toString() === r.id);
      return {
        "Roll number": r.rollNumber || "",
        "Boarding hostel": hostelMap[r.fromHostelId?.toString()] || "Unknown",
        "Preference 1": hostelMap[u?.next_mess1?.toString()] || "N/A",
        "Preference 2": hostelMap[u?.next_mess2?.toString()] || "N/A",
        "Preference 3": hostelMap[u?.next_mess3?.toString()] || "N/A",
        Timestamp: u?.applied_hostel_timestamp
          ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })
          : "",
      };
    });

    const sheet4Data = hostels.map((h) => {
      const id = h._id.toString();
      const tracker = capacityTracker[id] || {};
      const finalCount =
        tracker.finalCount !== undefined ? tracker.finalCount : tracker.current;
      const incoming = acceptedUsers.filter(
        (a) => a.toHostelId?.toString() === id,
      ).length;
      const outgoing = acceptedUsers.filter(
        (a) => a.fromHostelId?.toString() === id,
      ).length;
      const net = incoming - outgoing;
      return {
        Hostel: h.hostel_name || "Unknown",
        Boarders: h.curr_cap || 0,
        "Mess subscribers": finalCount || 0,
        Incoming: incoming,
        Outgoing: outgoing,
        "Net Change": net,
      };
    });

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      wb,
      xlsx.utils.json_to_sheet(sheet1Data),
      "All Applications",
    );
    xlsx.utils.book_append_sheet(
      wb,
      xlsx.utils.json_to_sheet(sheet2Data),
      "Accepted Applications",
    );
    xlsx.utils.book_append_sheet(
      wb,
      xlsx.utils.json_to_sheet(sheet3Data),
      "Rejected Applications",
    );
    xlsx.utils.book_append_sheet(
      wb,
      xlsx.utils.json_to_sheet(sheet4Data),
      "Report Summary",
    );

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `Mess_Change_Report_${Date.now()}.xlsx`;

    // Save locally
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    xlsx.writeFile(wb, path.join(backupDir, filename), { bookType: "xlsx" });
    console.log(`Saved report locally to backup folder as ${filename}`);

    const url = await uploadReportToOnedrive(buffer, filename);
    if (url) {
      console.log("Mess change report uploaded: ", url);
    }
  } catch (err) {
    console.error("Error generating and uploading report:", err);
  }
};

// Controllers

const processAllMessChangeRequests = async (req, res) => {
  try {
    const users = await User.find({ applied_for_mess_changed: true });
    if (!users.length) {
      return res.status(400).json({ message: "No mess change requests found" });
    }

    const hostels = await Hostel.find({});
    createBackup(users, hostels);

    const capacityTracker = await initializeCapacityTracker(hostels);

    const { acceptedUsers, rejectedUsers } = await processUsersInIterations(
      users,
      capacityTracker,
    );

    await generateAndUploadReport(
      users,
      acceptedUsers,
      rejectedUsers,
      capacityTracker,
      hostels,
    );

    await updateAcceptedUsers(acceptedUsers, users, hostels);
    await updateRejectedUsers(rejectedUsers, users);
    await updateLastProcessedTimestamp();

    sendNotificationMessage(
      "MESS CHANGE",
      "Mess Change is Disabled",
      "All_Hostels",
      { redirectType: "mess_change", isAlert: "true" },
    ).catch((err) =>
      console.error("Mess change disabled notification failed:", err),
    );

    if (res) {
      res.status(200).json({
        message: `${acceptedUsers.length} accepted, ${rejectedUsers.length} rejected`,
        acceptedUsers,
        rejectedUsers,
      });
    }
  } catch (err) {
    console.error(err);
    if (res) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

module.exports = {
  processAllMessChangeRequests,
  resetAllUsersToHostel,
  updateLastProcessedTimestamp,
};
