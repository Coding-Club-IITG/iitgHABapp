const schedule = require("node-schedule");
const Leave = require("./leaveModel.js");
const { User } = require("../user/userModel.js");

const initializeMessRebateAutoScheduler = async () => {
  console.log("🚀 Initializing mess rebate scheduler...");
  schedule.scheduleJob("0 1 * * *", async () => {
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

    const NotRejectedNorResolvedApplications = await Leave.find({
      resolved: false,
      status: {
        $in: ["pending", "approved"],
      },
    })
      .sort({
        appliedAt: -1,
      })
      .lean();

    console.log("Not Rejected Nor Resolved Applications");
    console.log(NotRejectedNorResolvedApplications);

    // FOR GIVING BACK SCANNER PERMISSION AT THE END
    {
      const to_check = NotRejectedNorResolvedApplications.filter((app) => {
        return yesterday <= app.endDate && app.endDate < today;
      });

      const user_ids = to_check.map((application) => application.user);

      if (user_ids.length > 0) {
        const result = await User.updateMany(
          { _id: { $in: user_ids } },
          { $set: { scannerPermission: true } },
        );
        console.log(
          `PERMITTED USERS: ${result.modifiedCount} users re-enabled`,
        );
      }
    }

    // FOR TAKING AWAY SCANNER PERMISSION AT THE START
    {
      const to_check = NotRejectedNorResolvedApplications.filter((app) => {
        return today <= app.startDate && app.startDate < tomorrow;
      });

      const user_ids = to_check.map((application) => application.user);

      if (user_ids.length > 0) {
        const result = await User.updateMany(
          { _id: { $in: user_ids } },
          { $set: { scannerPermission: false } },
        );
        console.log(
          `RESTRICTED USERS: ${result.modifiedCount} users restricted`,
        );
      }
    }

    // FOR REJECTING AND GIVING BACK SCANNER PERMISSION AT 7 DAYS MEDICAL
    {
      const to_check = await Leave.find({
        resolved: false,
        status: {
          $in: ["pending"],
        },
        leaveType: "Medical",
        startDate: {
          $gte: yesterweek,
          $lt: today,
        },
      }).lean();

      const targetIds = to_check.map((t) => t._id);

      if (targetIds.length > 0) {
        await Leave.updateMany(
          {
            _id: { $in: targetIds },
          },
          {
            resolved: true,
            status: "rejected",
            feedback: "Medical Application Not Submitted On Time",
          },
        );

        const user_ids = to_check.map((application) => application.user);

        const result = await User.updateMany(
          { _id: { $in: user_ids } },
          { $set: { scannerPermission: true } },
        );
        console.log(
          `REJECTED MEDICAL USERS: ${result.modifiedCount} users re-enabled, ${targetIds.length} leaves rejected`,
        );
      }
    }
  });

  console.log("✅ Automatic mess rebate canceller initialized");
  console.log("📅 Rebate cancelling scheduled: Everyday at 1:00 AM IST");
};

module.exports = {
  initializeMessRebateAutoScheduler,
};
