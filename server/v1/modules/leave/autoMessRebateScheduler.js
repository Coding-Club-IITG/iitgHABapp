const Leave = require("./leaveModel.js");
const { User } = require("../user/userModel.js");
const { withTransaction } = require("../../utils/withTransaction.js");
const agenda = require("../../utils/agenda.js");

const JOB_NAME = "mess-rebate-daily";

// Core logic
const runMessRebateJob = async () => {
  const today = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
    0,
    0,
    0,
    0,
  );
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
    0,
    0,
    0,
    0,
  );
  const tomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  const yesterweek = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 7,
    0,
    0,
    0,
    0,
  );
  const yesterweekplusone = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 6,
    0,
    0,
    0,
    0,
  );

  const activeApplications = await Leave.find({
    resolved: false,
    status: { $in: ["pending", "approved"] },
  })
    .sort({ appliedAt: -1 })
    .lean();

  console.log(
    `[MESS REBATE] Found ${activeApplications.length} active applications`,
  );

  // 1. Re-enable scanner permission when leave ends
  {
    const ending = activeApplications.filter(
      (app) => yesterday <= app.endDate && app.endDate < today,
    );
    const userIds = ending.map((a) => a.user);
    const userIdsToResolve = ending
      .filter((app) => app.status === "approved")
      .map((application) => application.user);

    if (userIds.length > 0) {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { scannerPermission: true } },
      );

      if (userIdsToResolve.length > 0) {
        const resolvedResult = await Leave.updateMany(
          { _id: { $in: userIdsToResolve } },
          { $set: { resolved: true } },
        );
        console.log(
          `[MESS REBATE] ${resolvedResult.modifiedCount} applications resolved`,
        );
      }

      console.log(
        `[MESS REBATE] Re-enabled scanner for ${result.modifiedCount} users (leave ended)`,
      );
    }
  }

  // 2. Revoke scanner permission when leave starts
  {
    const starting = activeApplications.filter(
      (app) => today <= app.startDate && app.startDate < tomorrow,
    );
    const userIds = starting.map((a) => a.user);
    if (userIds.length > 0) {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { scannerPermission: false } },
      );
      console.log(
        `[MESS REBATE] Revoked scanner for ${result.modifiedCount} users (leave started)`,
      );
    }
  }

  // 3. Auto-reject medical leaves not submitted within 7 days
  {
    const expiredMedical = await Leave.find({
      resolved: false,
      proofDocumentUrl: null,
      leaveType: "Medical",
      appliedAt: {
        $gte: yesterweek,
        $lt: yesterweekplusone,
      },
    }).lean();

    const targetIds = expiredMedical.map((t) => t._id);

    if (targetIds.length > 0) {
      const userIds = expiredMedical.map((a) => a.user);

      await withTransaction(async (session) => {
        await Leave.updateMany(
          { _id: { $in: targetIds } },
          {
            resolved: true,
            status: "rejected",
            feedback: "Medical Application Not Submitted On Time",
          },
          { session },
        );

        await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { scannerPermission: true } },
          { session },
        );
      });

      console.log(
        `[MESS REBATE] Auto-rejected ${targetIds.length} expired medical leaves, scanner restored for ${userIds.length} users`,
      );
    }
  }
};

const initializeMessRebateAutoScheduler = () => {
  agenda.define(
    JOB_NAME,
    async (job) => {
      try {
        console.log("[MESS REBATE] Daily job fired");
        await runMessRebateJob();
      } catch (err) {
        console.error("[MESS REBATE] Job failed:", err);
        throw err;
      }
    },
    { concurrency: 1 },
  );

  // Every day at 01:00 AM IST
  agenda.every("0 1 * * *", JOB_NAME, {}, { timezone: "Asia/Kolkata" });

  console.log("[MESS REBATE] Scheduled: every day at 01:00 AM IST");
};

module.exports = {
  initializeMessRebateAutoScheduler,
  runMessRebateJob,
};
