import { RoomCleaningBooking } from "../room_cleaning/roomCleaningBookingModel.js";
import agenda from "../../utils/agenda.js";

const JOB_NAME = "room-cleaning-auto-resolve";

// Auto-resolve unresolved bookings from previous day
async function autoResolveUnresolvedBookings() {
  // Derive yesterday's start-of-day in IST
  const now = new Date();
  const istNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  istNow.setHours(0, 0, 0, 0); // start of today IST
  const yesterdayIST = new Date(istNow);
  yesterdayIST.setDate(istNow.getDate() - 1); // start of yesterday IST

  const result = await RoomCleaningBooking.updateMany(
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
    `[ROOM CLEANING] Auto-resolved ${result.modifiedCount} bookings before ${yesterdayIST.toISOString().slice(0, 10)}`,
  );
}

export function initializeRoomCleaningAutoResolveScheduler() {
  agenda.define(
    JOB_NAME,
    async (job) => {
      try {
        console.log("[ROOM CLEANING] Auto-resolve job fired");
        await autoResolveUnresolvedBookings();
      } catch (err) {
        console.error("[ROOM CLEANING] Auto-resolve job failed:", err);
        throw err;
      }
    },
    { concurrency: 1 },
  );

  // Every day at 00:30 AM IST
  agenda.every("30 0 * * *", JOB_NAME, {}, { timezone: "Asia/Kolkata" });

  console.log("[ROOM CLEANING] Scheduled: every day at 00:30 AM IST");
}
