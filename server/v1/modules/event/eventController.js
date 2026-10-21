import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";

import AppError from "../../utils/appError.js";
import { getIstStartOfToday } from "../../utils/date.js";
import { User } from "../user/userModel.js";
import { sendNotificationToUser } from "../notification/notificationController.js";
import { Event } from "./eventModel.js";
import {
  EventRegistration,
  REGISTRATION_STATUSES,
} from "./eventRegistrationModel.js";
import * as eventService from "./eventService.js";

// Sends AppErrors as `{ message }` with their status; anything else is a 500.
const handle = (name, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.status).json({ message: error.message });
    }
    logger.error(`${name}:`, { error });
    return res.status(500).json({ message: "Internal server error" });
  }
};

const ATTENDEE_FIELDS = "name rollNumber profilePictureUrl hostel";

function toAttendee(user) {
  if (!user) return null;
  return {
    name: user.name,
    rollNumber: user.rollNumber || "",
    profilePictureUrl: user.profilePictureUrl || null,
    hostelName: user.hostel?.hostel_name || null,
  };
}

async function loadStudentEvent(eventId, user) {
  const event = await Event.findById(eventId).lean();
  if (!event || (!event.isPublished && !eventService.isVolunteer(event, user._id))) {
    throw new AppError(404, "Event not found");
  }
  const reg = await EventRegistration.findOne({ event: eventId, user: user._id }).lean();
  return eventService.toStudentEvent(event, reg, user._id);
}

// ---------- Students ----------

/** Upcoming and ongoing events, plus any event the user volunteers for. */
export const listEvents = handle("listEvents", async (req, res) => {
  const now = new Date();
  const events = await Event.find({
    $and: [
      { $or: [{ isPublished: true }, { volunteers: req.user._id }] },
      {
        $or: [
          { endsAt: { $gte: now } },
          { endsAt: null, startsAt: { $gte: getIstStartOfToday() } },
        ],
      },
    ],
  })
    .sort({ startsAt: 1 })
    .lean();

  const regs = await EventRegistration.find({
    user: req.user._id,
    event: { $in: events.map((e) => e._id) },
  }).lean();
  const regByEvent = new Map(regs.map((r) => [String(r.event), r]));

  return res.json({
    events: events.map((e) =>
      eventService.toStudentEvent(e, regByEvent.get(String(e._id)), req.user._id),
    ),
  });
});

export const getEvent = handle("getEvent", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
    throw new AppError(400, "Invalid event id");
  }
  return res.json({ event: await loadStudentEvent(req.params.eventId, req.user) });
});

export const registerForEvent = handle("registerForEvent", async (req, res) => {
  const reg = await eventService.register(req.params.eventId, req.user._id);
  return res.status(201).json({
    message:
      reg.status === "approved"
        ? "You're registered. Show your QR at the entry."
        : "Registration submitted. You'll get your QR once it's approved.",
    event: await loadStudentEvent(req.params.eventId, req.user),
  });
});

export const cancelEventRegistration = handle(
  "cancelEventRegistration",
  async (req, res) => {
    await eventService.cancelRegistration(req.params.eventId, req.user._id);
    return res.json({
      message: "Registration cancelled",
      event: await loadStudentEvent(req.params.eventId, req.user),
    });
  },
);

// ---------- Volunteers ----------

export const checkInAttendee = handle("checkInAttendee", async (req, res) => {
  const { status, registration } = await eventService.checkIn(
    req.params.eventId,
    req.user._id,
    req.body?.qrPayload,
  );
  const attendee = await User.findById(registration.user)
    .select(ATTENDEE_FIELDS)
    .populate("hostel", "hostel_name")
    .lean();

  const alreadyIn = status === "already_checked_in";
  return res.status(alreadyIn ? 409 : 200).json({
    status,
    message: alreadyIn ? "Already entered" : "Entry allowed",
    attendee: toAttendee(attendee),
    checkedInAt: registration.checkedInAt,
  });
});

export const getVolunteerStats = handle("getVolunteerStats", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
    throw new AppError(400, "Invalid event id");
  }
  const event = await Event.findById(req.params.eventId).lean();
  if (!event) throw new AppError(404, "Event not found");
  if (!eventService.isVolunteer(event, req.user._id)) {
    throw new AppError(403, "You are not a volunteer for this event");
  }
  return res.json(await eventService.getCheckInStats(event._id));
});

export const joinAsVolunteer = handle("joinAsVolunteer", async (req, res) => {
  await eventService.joinAsVolunteer(req.params.eventId, req.user._id, req.body?.code);
  return res.json({
    message: "You're now a volunteer for this event",
    event: await loadStudentEvent(req.params.eventId, req.user),
  });
});

// ---------- HAB ----------

export const adminListEvents = handle("adminListEvents", async (req, res) => {
  const events = await Event.find().sort({ startsAt: -1 }).lean();
  const counts = await EventRegistration.aggregate([
    { $match: { event: { $in: events.map((e) => e._id) } } },
    {
      $group: {
        _id: "$event",
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        checkedIn: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } },
      },
    },
  ]);
  const countsByEvent = new Map(counts.map((c) => [String(c._id), c]));
  const empty = { pending: 0, approved: 0, rejected: 0, checkedIn: 0 };

  return res.json({
    events: events.map((e) => {
      const { _id, ...c } = countsByEvent.get(String(e._id)) || { _id: null, ...empty };
      return { ...e, volunteerCount: e.volunteers.length, counts: c };
    }),
  });
});

export const adminGetEvent = handle("adminGetEvent", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
    throw new AppError(400, "Invalid event id");
  }
  const event = await Event.findById(req.params.eventId)
    .populate("volunteers", "name rollNumber email")
    .lean();
  if (!event) throw new AppError(404, "Event not found");
  return res.json({
    event,
    stats: await eventService.getCheckInStats(event._id),
  });
});

export const adminCreateEvent = handle("adminCreateEvent", async (req, res) => {
  const data = eventService.parseEventInput(req.body);
  const event = await Event.create({ ...data, createdBy: req.hab?.email || "" });
  return res.status(201).json({ message: "Event created", event });
});

export const adminUpdateEvent = handle("adminUpdateEvent", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
    throw new AppError(400, "Invalid event id");
  }
  const event = await Event.findById(req.params.eventId);
  if (!event) throw new AppError(404, "Event not found");
  event.set(eventService.parseEventInput(req.body, event));
  await event.save();
  return res.json({ message: "Event updated", event });
});

export const adminDeleteEvent = handle("adminDeleteEvent", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
    throw new AppError(400, "Invalid event id");
  }
  const event = await Event.findByIdAndDelete(req.params.eventId);
  if (!event) throw new AppError(404, "Event not found");
  await EventRegistration.deleteMany({ event: event._id });
  return res.json({ message: "Event deleted" });
});

export const adminListRegistrations = handle(
  "adminListRegistrations",
  async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      throw new AppError(400, "Invalid event id");
    }
    const filter = { event: req.params.eventId };
    if (req.query.status) {
      if (!REGISTRATION_STATUSES.includes(req.query.status)) {
        throw new AppError(400, "Invalid status");
      }
      filter.status = req.query.status;
    }
    const registrations = await EventRegistration.find(filter)
      .select("-qrToken")
      .sort({ createdAt: 1 })
      .populate({
        path: "user",
        select: "name rollNumber email hostel",
        populate: { path: "hostel", select: "hostel_name" },
      })
      .populate("checkedInBy", "name rollNumber")
      .lean();
    return res.json({ registrations });
  },
);

export const adminApproveRegistration = handle(
  "adminApproveRegistration",
  async (req, res) => {
    const { eventId, registrationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      throw new AppError(400, "Invalid registration id");
    }
    const before = await EventRegistration.findById(registrationId).select("status").lean();
    const reg = await eventService.approveRegistration(eventId, registrationId);

    if (before && before.status !== "approved") {
      const event = await Event.findById(eventId).select("title").lean();
      // Fire-and-forget; sendNotificationToUser logs its own failures.
      sendNotificationToUser(
        reg.user,
        "Registration approved",
        `You're in for ${event?.title || "the event"}. Your entry QR is in the Events section.`,
      );
    }
    return res.json({ message: "Registration approved", status: reg.status });
  },
);

export const adminRejectRegistration = handle(
  "adminRejectRegistration",
  async (req, res) => {
    const { eventId, registrationId } = req.params;
    const reg = await eventService.rejectRegistration(eventId, registrationId);
    return res.json({ message: "Registration rejected", status: reg.status });
  },
);

/** Body: { code?: string }. Omit `code` to generate a new random one. */
export const adminSetVolunteerCode = handle("adminSetVolunteerCode", async (req, res) => {
  const volunteerCode = await eventService.setVolunteerCode(
    req.params.eventId,
    req.body?.code,
  );
  return res.json({ message: "Volunteer access code updated", volunteerCode });
});

/** Replaces the volunteer list. Body: { rollNumbers: string[] } */
export const adminSetVolunteers = handle("adminSetVolunteers", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
    throw new AppError(400, "Invalid event id");
  }
  const raw = Array.isArray(req.body?.rollNumbers) ? req.body.rollNumbers : null;
  if (!raw) throw new AppError(400, "rollNumbers must be an array");
  const rollNumbers = [...new Set(raw.map((r) => String(r).trim()).filter(Boolean))];

  const users = await User.find({ rollNumber: { $in: rollNumbers } })
    .select("_id rollNumber")
    .lean();
  const found = new Set(users.map((u) => u.rollNumber));
  const notFound = rollNumbers.filter((r) => !found.has(r));

  const event = await Event.findByIdAndUpdate(
    req.params.eventId,
    { $set: { volunteers: users.map((u) => u._id) } },
    { new: true },
  ).populate("volunteers", "name rollNumber email");
  if (!event) throw new AppError(404, "Event not found");

  return res.json({
    message: "Volunteers updated",
    volunteers: event.volunteers,
    notFound,
  });
});
