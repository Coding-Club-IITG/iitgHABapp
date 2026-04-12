const schedule = require("node-schedule");
const {
  RoomCleaningBooking,
} = require("../room_cleaning/roomCleaningBookingModel");

// Auto-resolve unresolved bookings from previous day
async function autoResolveUnresolvedBookings() {
  try {
    // Get yesterday's date in IST
    const now = new Date();
    const istNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    istNow.setHours(0, 0, 0, 0); // Start of today IST
    const yesterdayIST = new Date(istNow);
    yesterdayIST.setDate(istNow.getDate() - 1); // Start of yesterday IST

    // Find bookings before yesterday that are still unresolved
    const unresolved = await RoomCleaningBooking.updateMany(
      {
        bookingDate: { $lt: yesterdayIST },
        status: { $in: ["Booked", "Buffered"] },
      },
      {
        $set: {
          status: "CouldNotBeCleaned",
          reason: "Room Cleaners Not Available",
          statusFinalizedAt: new Date(),
        },
      },
    );

    console.log(
      `[RoomCleaning] Auto-resolved ${unresolved.modifiedCount} bookings before date ${yesterdayIST.toISOString().slice(0, 10)}.`,
    );
  } catch (err) {
    console.error("[RoomCleaning] Auto-resolve failed:", err);
  }
}

function initializeRoomCleaningAutoResolveScheduler() {
  console.log("\u23F0 Initializing room cleaning auto-resolve scheduler...");
  // Run every day at 00:30 AM IST
  schedule.scheduleJob(
    { hour: 0, minute: 30, tz: "Asia/Kolkata" },
    autoResolveUnresolvedBookings,
  );
  console.log(
    "\u2705 Room cleaning auto-resolve scheduled: Every day at 00:30 AM IST",
  );
}

module.exports = { initializeRoomCleaningAutoResolveScheduler };
