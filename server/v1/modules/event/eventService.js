import crypto from "crypto";
import mongoose from "mongoose";

import AppError from "../../utils/appError.js";
import { Event, generateVolunteerCode } from "./eventModel.js";
import { EventRegistration } from "./eventRegistrationModel.js";

// Entry QR payload: "habit-event:<eventId>:<qrToken>"
export const QR_PREFIX = "habit-event";

export function buildQrPayload(eventId, qrToken) {
  return `${QR_PREFIX}:${eventId}:${qrToken}`;
}

export function parseQrPayload(payload) {
  if (typeof payload !== "string") return null;
  const parts = payload.trim().split(":");
  if (parts.length !== 3 || parts[0] !== QR_PREFIX) return null;
  const [, eventId, qrToken] = parts;
  if (!mongoose.Types.ObjectId.isValid(eventId) || !/^[a-f0-9]{48}$/.test(qrToken)) {
    return null;
  }
  return { eventId, qrToken };
}

export function generateQrToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function registrationClosesAt(event) {
  return event.registrationClosesAt || event.endsAt || event.startsAt;
}

export function isVolunteer(event, userId) {
  return (event.volunteers || []).some((v) => String(v) === String(userId));
}

function assertObjectId(id, label) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, `Invalid ${label}`);
  }
}

// Atomically takes one seat; returns false when the event is full.
async function reserveSeat(eventId) {
  const updated = await Event.findOneAndUpdate(
    {
      _id: eventId,
      $or: [
        { capacity: 0 },
        { $expr: { $lt: ["$approvedCount", "$capacity"] } },
      ],
    },
    { $inc: { approvedCount: 1 } },
    { new: true },
  );
  return Boolean(updated);
}

async function releaseSeat(eventId) {
  await Event.updateOne(
    { _id: eventId, approvedCount: { $gt: 0 } },
    { $inc: { approvedCount: -1 } },
  );
}

/** Serializes a registration for its owner. The QR is only shown once approved. */
export function toStudentRegistration(reg) {
  if (!reg) return null;
  return {
    _id: reg._id,
    status: reg.status,
    qrPayload:
      reg.status === "approved" && reg.qrToken
        ? buildQrPayload(reg.event, reg.qrToken)
        : null,
    checkedInAt: reg.checkedInAt || null,
    createdAt: reg.createdAt,
  };
}

export function toStudentEvent(event, reg, userId) {
  const capacity = event.capacity || 0;
  return {
    _id: event._id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    registrationClosesAt: registrationClosesAt(event),
    requiresApproval: event.requiresApproval,
    capacity,
    seatsLeft: capacity > 0 ? Math.max(capacity - event.approvedCount, 0) : null,
    isVolunteer: isVolunteer(event, userId),
    myRegistration: toStudentRegistration(reg),
  };
}

export async function register(eventId, userId, now = new Date()) {
  assertObjectId(eventId, "event id");
  const event = await Event.findById(eventId);
  if (!event || !event.isPublished) throw new AppError(404, "Event not found");
  if (now > registrationClosesAt(event)) {
    throw new AppError(400, "Registrations for this event are closed");
  }

  const existing = await EventRegistration.findOne({ event: eventId, user: userId });
  if (existing) throw new AppError(409, "You have already registered for this event");

  if (event.requiresApproval) {
    try {
      return await EventRegistration.create({
        event: eventId,
        user: userId,
        status: "pending",
      });
    } catch (err) {
      if (err?.code === 11000) {
        throw new AppError(409, "You have already registered for this event");
      }
      throw err;
    }
  }

  if (!(await reserveSeat(eventId))) {
    throw new AppError(409, "This event is full");
  }
  try {
    return await EventRegistration.create({
      event: eventId,
      user: userId,
      status: "approved",
      qrToken: generateQrToken(),
    });
  } catch (err) {
    await releaseSeat(eventId);
    if (err?.code === 11000) {
      throw new AppError(409, "You have already registered for this event");
    }
    throw err;
  }
}

export async function cancelRegistration(eventId, userId) {
  assertObjectId(eventId, "event id");
  // Rejected registrations stay, so a student can't clear a rejection and re-apply.
  const reg = await EventRegistration.findOneAndDelete({
    event: eventId,
    user: userId,
    checkedInAt: null,
    status: { $ne: "rejected" },
  });
  if (!reg) {
    const existing = await EventRegistration.findOne({ event: eventId, user: userId });
    if (existing?.checkedInAt) {
      throw new AppError(400, "You have already entered this event");
    }
    if (existing) {
      throw new AppError(400, "This registration can't be cancelled");
    }
    throw new AppError(404, "You are not registered for this event");
  }
  if (reg.status === "approved") await releaseSeat(eventId);
  return reg;
}

export async function approveRegistration(eventId, registrationId) {
  assertObjectId(eventId, "event id");
  assertObjectId(registrationId, "registration id");
  const reg = await EventRegistration.findOne({ _id: registrationId, event: eventId });
  if (!reg) throw new AppError(404, "Registration not found");
  if (reg.status === "approved") return reg;

  if (!(await reserveSeat(eventId))) {
    throw new AppError(409, "This event is full");
  }
  const updated = await EventRegistration.findOneAndUpdate(
    { _id: registrationId, event: eventId, status: { $ne: "approved" } },
    { $set: { status: "approved", qrToken: generateQrToken() } },
    { new: true },
  );
  if (!updated) {
    // Approved concurrently by someone else; give the seat back.
    await releaseSeat(eventId);
    return EventRegistration.findById(registrationId);
  }
  return updated;
}

export async function rejectRegistration(eventId, registrationId) {
  assertObjectId(eventId, "event id");
  assertObjectId(registrationId, "registration id");
  const previous = await EventRegistration.findOneAndUpdate(
    {
      _id: registrationId,
      event: eventId,
      status: { $ne: "rejected" },
      checkedInAt: null,
    },
    { $set: { status: "rejected" }, $unset: { qrToken: 1 } },
    { new: false },
  );
  if (!previous) {
    const reg = await EventRegistration.findOne({ _id: registrationId, event: eventId });
    if (!reg) throw new AppError(404, "Registration not found");
    if (reg.checkedInAt) {
      throw new AppError(400, "This student has already entered the event");
    }
    return reg;
  }
  if (previous.status === "approved") await releaseSeat(eventId);
  return EventRegistration.findById(registrationId);
}

/**
 * Volunteer scan. Marks the registration as checked in exactly once.
 * Returns { status: "checked_in" | "already_checked_in", registration }.
 */
export async function checkIn(eventId, volunteerId, payload, now = new Date()) {
  assertObjectId(eventId, "event id");
  const event = await Event.findById(eventId);
  if (!event) throw new AppError(404, "Event not found");
  if (!isVolunteer(event, volunteerId)) {
    throw new AppError(403, "You are not a volunteer for this event");
  }

  const parsed = parseQrPayload(payload);
  if (!parsed) throw new AppError(400, "This is not a valid event entry QR");
  if (parsed.eventId !== String(eventId)) {
    throw new AppError(400, "This QR is for a different event");
  }

  const reg = await EventRegistration.findOneAndUpdate(
    {
      event: eventId,
      qrToken: parsed.qrToken,
      status: "approved",
      checkedInAt: null,
    },
    { $set: { checkedInAt: now, checkedInBy: volunteerId } },
    { new: true },
  );
  if (reg) return { status: "checked_in", registration: reg };

  const existing = await EventRegistration.findOne({
    event: eventId,
    qrToken: parsed.qrToken,
  });
  if (!existing || existing.status !== "approved") {
    throw new AppError(404, "No approved registration found for this QR");
  }
  return { status: "already_checked_in", registration: existing };
}

function normalizeCode(code) {
  return String(code ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Adds the user as a volunteer if `code` matches the event's access code. */
export async function joinAsVolunteer(eventId, userId, code) {
  assertObjectId(eventId, "event id");
  const event = await Event.findById(eventId);
  if (!event || !event.isPublished) throw new AppError(404, "Event not found");
  if (isVolunteer(event, userId)) return event;

  const given = Buffer.from(normalizeCode(code));
  const expected = Buffer.from(normalizeCode(event.volunteerCode));
  if (
    !expected.length ||
    given.length !== expected.length ||
    !crypto.timingSafeEqual(given, expected)
  ) {
    throw new AppError(403, "Incorrect access code");
  }

  await Event.updateOne({ _id: eventId }, { $addToSet: { volunteers: userId } });
  return event;
}

/**
 * Sets the event's shared volunteer code: HAB's own `code` if given
 * (4-20 letters/digits), otherwise a newly generated one.
 */
export async function setVolunteerCode(eventId, code) {
  assertObjectId(eventId, "event id");
  let volunteerCode = generateVolunteerCode();
  if (code !== undefined && code !== null && String(code).trim() !== "") {
    volunteerCode = normalizeCode(code);
    if (!/^[A-Z0-9]{4,20}$/.test(volunteerCode)) {
      throw new AppError(400, "Access code must be 4-20 letters or digits");
    }
  }
  const event = await Event.findByIdAndUpdate(
    eventId,
    { $set: { volunteerCode } },
    { new: true },
  );
  if (!event) throw new AppError(404, "Event not found");
  return event.volunteerCode;
}

export async function getCheckInStats(eventId) {
  const [approved, checkedIn] = await Promise.all([
    EventRegistration.countDocuments({ event: eventId, status: "approved" }),
    EventRegistration.countDocuments({
      event: eventId,
      status: "approved",
      checkedInAt: { $ne: null },
    }),
  ]);
  return { approved, checkedIn };
}

const EDITABLE_FIELDS = [
  "title",
  "description",
  "venue",
  "startsAt",
  "endsAt",
  "registrationClosesAt",
  "capacity",
  "requiresApproval",
  "isPublished",
];

function parseOptionalDate(value, label) {
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new AppError(400, `Invalid ${label}`);
  return date;
}

/**
 * Validates a HAB create/update body. With `existing`, missing fields keep
 * their current values (partial update).
 */
export function parseEventInput(body = {}, existing = null) {
  const out = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }

  if (out.title !== undefined) {
    out.title = String(out.title).trim();
    if (!out.title) throw new AppError(400, "Title is required");
  } else if (!existing) {
    throw new AppError(400, "Title is required");
  }
  if (out.description !== undefined) out.description = String(out.description).trim();
  if (out.venue !== undefined) out.venue = String(out.venue).trim();

  if (out.startsAt !== undefined) {
    out.startsAt = parseOptionalDate(out.startsAt, "start time");
    if (!out.startsAt) throw new AppError(400, "Start time is required");
  } else if (!existing) {
    throw new AppError(400, "Start time is required");
  }
  if (out.endsAt !== undefined) out.endsAt = parseOptionalDate(out.endsAt, "end time");
  if (out.registrationClosesAt !== undefined) {
    out.registrationClosesAt = parseOptionalDate(
      out.registrationClosesAt,
      "registration close time",
    );
  }

  if (out.capacity !== undefined) {
    const capacity = Number(out.capacity);
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new AppError(400, "Capacity must be a whole number (0 for unlimited)");
    }
    out.capacity = capacity;
    if (existing && capacity > 0 && capacity < existing.approvedCount) {
      throw new AppError(
        400,
        `Capacity can't be below the ${existing.approvedCount} already approved registrations`,
      );
    }
  }
  if (out.requiresApproval !== undefined) out.requiresApproval = Boolean(out.requiresApproval);
  if (out.isPublished !== undefined) out.isPublished = Boolean(out.isPublished);

  const startsAt = out.startsAt ?? existing?.startsAt;
  const endsAt = out.endsAt !== undefined ? out.endsAt : existing?.endsAt;
  if (endsAt && startsAt && endsAt < startsAt) {
    throw new AppError(400, "End time must be after the start time");
  }
  return out;
}
