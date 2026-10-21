import express from "express";
import rateLimit from "express-rate-limit";

import {
  authenticateJWT,
  authenticateHabJWT,
} from "../../middleware/authenticateJWT.js";

import {
  listEvents,
  getEvent,
  registerForEvent,
  cancelEventRegistration,
  checkInAttendee,
  getVolunteerStats,
  adminListEvents,
  adminGetEvent,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
  adminListRegistrations,
  adminApproveRegistration,
  adminRejectRegistration,
  adminSetVolunteers,
  joinAsVolunteer,
  adminSetVolunteerCode,
} from "./eventController.js";

const eventRouter = express.Router();

// Slows down guessing volunteer access codes: 10 tries per user per 15 minutes.
const volunteerCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again in a few minutes." },
});

// HAB (static /admin paths before /:eventId)
eventRouter.get("/admin", authenticateHabJWT, adminListEvents);
eventRouter.post("/admin", authenticateHabJWT, adminCreateEvent);
eventRouter.get("/admin/:eventId", authenticateHabJWT, adminGetEvent);
eventRouter.patch("/admin/:eventId", authenticateHabJWT, adminUpdateEvent);
eventRouter.delete("/admin/:eventId", authenticateHabJWT, adminDeleteEvent);
eventRouter.get(
  "/admin/:eventId/registrations",
  authenticateHabJWT,
  adminListRegistrations,
);
eventRouter.post(
  "/admin/:eventId/registrations/:registrationId/approve",
  authenticateHabJWT,
  adminApproveRegistration,
);
eventRouter.post(
  "/admin/:eventId/registrations/:registrationId/reject",
  authenticateHabJWT,
  adminRejectRegistration,
);
eventRouter.put(
  "/admin/:eventId/volunteer-code",
  authenticateHabJWT,
  adminSetVolunteerCode,
);
eventRouter.put(
  "/admin/:eventId/volunteers",
  authenticateHabJWT,
  adminSetVolunteers,
);

// App: students
eventRouter.get("/", authenticateJWT, listEvents);
eventRouter.get("/:eventId", authenticateJWT, getEvent);
eventRouter.post("/:eventId/register", authenticateJWT, registerForEvent);
eventRouter.delete("/:eventId/register", authenticateJWT, cancelEventRegistration);

// App: volunteers
eventRouter.post(
  "/:eventId/volunteer",
  authenticateJWT,
  volunteerCodeLimiter,
  joinAsVolunteer,
);
eventRouter.post("/:eventId/check-in", authenticateJWT, checkInAttendee);
eventRouter.get("/:eventId/check-in/stats", authenticateJWT, getVolunteerStats);

export default eventRouter;
