const express = require("express");
const {
  getAvailability,
  createBooking,
  cancelBooking,
  getMyBookings,
  submitFeedback,
  getRcTomorrow,
  postRcTomorrowAssign,
  postRcFinalizeStatuses,
  getRcCleaners,
  postRcCleaner,
  putRcCleaner,
  deleteRcCleaner,
} = require("./roomCleaningController");
const {
  authenticateJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT");

const roomCleaningRouter = express.Router();

// GET /api/room-cleaning/availability?date=YYYY-MM-DD[&hostelId=...]
roomCleaningRouter.get("/availability", authenticateJWT, getAvailability);

// POST /api/room-cleaning/booking
roomCleaningRouter.post("/booking", authenticateJWT, createBooking);

// POST /api/room-cleaning/booking/cancel
roomCleaningRouter.post("/booking/cancel", authenticateJWT, cancelBooking);

// GET /api/room-cleaning/booking/my
roomCleaningRouter.get("/booking/my", authenticateJWT, getMyBookings);

// POST /api/room-cleaning/booking/feedback
roomCleaningRouter.post(
  "/booking/feedback",
  authenticateJWT,
  submitFeedback,
);

// RC Manager (HABit RC app): tomorrow bookings and assignments
roomCleaningRouter.get(
  "/rc/tomorrow",
  authenticateMessManagerJWT,
  getRcTomorrow,
);
roomCleaningRouter.post(
  "/rc/tomorrow/assign",
  authenticateMessManagerJWT,
  postRcTomorrowAssign,
);

// RC Manager (HABit RC app): finalize statuses for a date (e.g. Yesterday)
roomCleaningRouter.post(
  "/rc/status/finalize",
  authenticateMessManagerJWT,
  postRcFinalizeStatuses,
);

// Hostel frontend: manage room cleaners
roomCleaningRouter.get(
  "/rc/cleaners",
  authenticateMessManagerJWT,
  getRcCleaners,
);
roomCleaningRouter.post(
  "/rc/cleaners",
  authenticateMessManagerJWT,
  postRcCleaner,
);
roomCleaningRouter.put(
  "/rc/cleaners/:id",
  authenticateMessManagerJWT,
  putRcCleaner,
);
roomCleaningRouter.delete(
  "/rc/cleaners/:id",
  authenticateMessManagerJWT,
  deleteRcCleaner,
);

module.exports = roomCleaningRouter;

