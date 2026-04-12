const Leave = require("./leaveModel.js");
const { User } = require("../user/userModel.js");
const { withTransaction } = require("../../utils/withTransaction.js");
const agenda = require("../../utils/agenda.js");

const JOB_NAME = "mess-rebate-daily";

const MS_PER_DAY = 86400000;

/** Start of local calendar day for a timestamp (same convention as the rest of this file). */
function startOfLocalDay(d) {
  const x = new Date(d);
  return new Date(
    x.getFullYear(),
    x.getMonth(),
    x.getDate(),
    0,
    0,
    0,
    0,
  );
}

/** Whole calendar days from application day (local) to `todayStart` (exclusive of the 7-day grace). */
function calendarDaysSinceAppliedDay(appliedAt, todayStart) {
  const appliedDay = startOfLocalDay(appliedAt);
  return Math.floor((todayStart - appliedDay) / MS_PER_DAY);
}

// Core logic — safe to re-run after missed days: uses "as of start of today", not only "yesterday".
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
  const tomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
    0,
    0,
    0,
    0,
  );

  const activeApplications = await Leave.find({
    status: { $in: ["Pending", "Acknowledged"] },
  })
    .sort({ appliedAt: -1 })
    .lean();

  console.log(
    `[MESS REBATE] Found ${activeApplications.length} active applications`,
  );

  // 1. Re-enable scanner when leave has ended (any time before today — catches missed runs)
  {
    const ending = activeApplications.filter((app) => app.endDate < today);
    const userIds = ending.map((a) => a.user);

    if (userIds.length > 0) {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { scannerPermission: true } },
      );

      console.log(
        `[MESS REBATE] Re-enabled scanner for ${result.modifiedCount} users (leave ended before today)`,
      );
    }
  }

  // 2. Revoke scanner when leave overlaps calendar "today" (started on or before today, not ended yet)
  {
    const onLeaveToday = activeApplications.filter(
      (app) => app.startDate < tomorrow && app.endDate >= today,
    );
    const userIds = onLeaveToday.map((a) => a.user);
    if (userIds.length > 0) {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { scannerPermission: false } },
      );
      console.log(
        `[MESS REBATE] Revoked scanner for ${result.modifiedCount} users (on leave today)`,
      );
    }
  }

  // 3. Medical Pending without proof after upload window (>7 calendar days since local application day)
  {
    const candidates = await Leave.find({
      status: "Pending",
      proofDocumentUrl: null,
      leaveType: "Medical",
    }).lean();

    const expiredMedical = candidates.filter(
      (a) => calendarDaysSinceAppliedDay(a.appliedAt, today) > 7,
    );

    const targetIds = expiredMedical.map((t) => t._id);

    if (targetIds.length > 0) {
      const userIds = expiredMedical.map((a) => a.user);

      await withTransaction(async (session) => {
        await Leave.updateMany(
          { _id: { $in: targetIds } },
          {
            status: "Cancelled",
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
        `[MESS REBATE] Auto-cancelled ${targetIds.length} expired medical leaves, scanner restored for ${userIds.length} users`,
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
