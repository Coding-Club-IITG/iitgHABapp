import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { Event, generateVolunteerCode } from "../modules/event/eventModel.js";
import { EventRegistration } from "../modules/event/eventRegistrationModel.js";
import * as svc from "../modules/event/eventService.js";

const id = () => new mongoose.Types.ObjectId();
const HOUR = 60 * 60 * 1000;

function makeEvent(overrides = {}) {
  return {
    _id: id(),
    title: "Alcheringa Pronite",
    isPublished: true,
    startsAt: new Date(Date.now() + 24 * HOUR),
    endsAt: null,
    registrationClosesAt: null,
    capacity: 0,
    approvedCount: 0,
    requiresApproval: false,
    volunteers: [],
    ...overrides,
  };
}

async function rejectsWith(promise, status, pattern) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.status, status);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

afterEach(() => mock.restoreAll());

describe("QR payload", () => {
  test("round-trips a generated token", () => {
    const eventId = String(id());
    const token = svc.generateQrToken();
    assert.deepEqual(svc.parseQrPayload(svc.buildQrPayload(eventId, token)), {
      eventId,
      qrToken: token,
    });
  });

  test("rejects other QR codes", () => {
    assert.equal(svc.parseQrPayload("6650f0c2a1b2c3d4e5f60718"), null);
    assert.equal(svc.parseQrPayload(`habit-event:${id()}:short`), null);
    assert.equal(svc.parseQrPayload(`other:${id()}:${svc.generateQrToken()}`), null);
    assert.equal(svc.parseQrPayload(undefined), null);
  });
});

describe("parseEventInput", () => {
  test("requires title and start time on create", () => {
    assert.throws(() => svc.parseEventInput({ startsAt: new Date() }), /Title/);
    assert.throws(() => svc.parseEventInput({ title: "X" }), /Start time/);
  });

  test("validates capacity and time order", () => {
    const startsAt = "2026-11-01T10:00:00Z";
    assert.throws(
      () => svc.parseEventInput({ title: "X", startsAt, capacity: -1 }),
      /Capacity/,
    );
    assert.throws(
      () => svc.parseEventInput({ title: "X", startsAt, endsAt: "2026-11-01T09:00:00Z" }),
      /End time/,
    );
    const ok = svc.parseEventInput({ title: " X ", startsAt, capacity: "50" });
    assert.equal(ok.title, "X");
    assert.equal(ok.capacity, 50);
  });

  test("partial update keeps existing values and guards approved seats", () => {
    const existing = makeEvent({ approvedCount: 10 });
    assert.deepEqual(svc.parseEventInput({ venue: " Auditorium " }, existing), {
      venue: "Auditorium",
    });
    assert.throws(() => svc.parseEventInput({ capacity: 5 }, existing), /below the 10/);
    assert.equal(svc.parseEventInput({ capacity: 0 }, existing).capacity, 0);
  });
});

describe("register", () => {
  let event;
  let userId;
  beforeEach(() => {
    event = makeEvent();
    userId = id();
    mock.method(Event, "findById", async () => event);
    mock.method(EventRegistration, "findOne", async () => null);
  });

  test("auto-approves and issues a QR token when no approval is needed", async () => {
    const reserve = mock.method(Event, "findOneAndUpdate", async () => event);
    const create = mock.method(EventRegistration, "create", async (doc) => doc);

    const reg = await svc.register(event._id, userId);
    assert.equal(reg.status, "approved");
    assert.match(reg.qrToken, /^[a-f0-9]{48}$/);
    assert.equal(reserve.mock.callCount(), 1);
    assert.equal(create.mock.callCount(), 1);
  });

  test("creates a pending registration without a token when approval is needed", async () => {
    event.requiresApproval = true;
    const reserve = mock.method(Event, "findOneAndUpdate", async () => event);
    mock.method(EventRegistration, "create", async (doc) => doc);

    const reg = await svc.register(event._id, userId);
    assert.equal(reg.status, "pending");
    assert.equal(reg.qrToken, undefined);
    assert.equal(reserve.mock.callCount(), 0);
  });

  test("refuses when the event is full", async () => {
    event.capacity = 1;
    mock.method(Event, "findOneAndUpdate", async () => null);
    const create = mock.method(EventRegistration, "create", async (doc) => doc);

    await rejectsWith(svc.register(event._id, userId), 409, /full/);
    assert.equal(create.mock.callCount(), 0);
  });

  test("refuses after registrations close", async () => {
    event.registrationClosesAt = new Date(Date.now() - HOUR);
    await rejectsWith(svc.register(event._id, userId), 400, /closed/);
  });

  test("refuses a second registration", async () => {
    mock.method(EventRegistration, "findOne", async () => ({ _id: id() }));
    await rejectsWith(svc.register(event._id, userId), 409, /already registered/);
  });

  test("gives the seat back if a concurrent duplicate insert fails", async () => {
    mock.method(Event, "findOneAndUpdate", async () => event);
    const release = mock.method(Event, "updateOne", async () => ({}));
    mock.method(EventRegistration, "create", async () => {
      throw Object.assign(new Error("dup"), { code: 11000 });
    });

    await rejectsWith(svc.register(event._id, userId), 409, /already registered/);
    assert.equal(release.mock.callCount(), 1);
  });

  test("hides unpublished events", async () => {
    event.isPublished = false;
    await rejectsWith(svc.register(event._id, userId), 404);
  });
});

describe("checkIn", () => {
  let event;
  let volunteerId;
  let token;
  beforeEach(() => {
    volunteerId = id();
    event = makeEvent({ volunteers: [volunteerId] });
    token = svc.generateQrToken();
    mock.method(Event, "findById", async () => event);
  });

  test("only assigned volunteers can scan", async () => {
    await rejectsWith(
      svc.checkIn(event._id, id(), svc.buildQrPayload(event._id, token)),
      403,
    );
  });

  test("rejects QR codes for another event or in the wrong format", async () => {
    await rejectsWith(
      svc.checkIn(event._id, volunteerId, svc.buildQrPayload(id(), token)),
      400,
      /different event/,
    );
    await rejectsWith(svc.checkIn(event._id, volunteerId, "hello"), 400, /not a valid/);
  });

  test("checks in an approved attendee once", async () => {
    const reg = { _id: id(), user: id(), status: "approved", checkedInAt: new Date() };
    const update = mock.method(EventRegistration, "findOneAndUpdate", async () => reg);

    const result = await svc.checkIn(
      event._id,
      volunteerId,
      svc.buildQrPayload(event._id, token),
    );
    assert.equal(result.status, "checked_in");
    const [filter, change] = update.mock.calls[0].arguments;
    assert.equal(filter.qrToken, token);
    assert.equal(filter.status, "approved");
    assert.equal(filter.checkedInAt, null);
    assert.equal(change.$set.checkedInBy, volunteerId);
  });

  test("reports a repeat scan as already checked in", async () => {
    mock.method(EventRegistration, "findOneAndUpdate", async () => null);
    mock.method(EventRegistration, "findOne", async () => ({
      status: "approved",
      checkedInAt: new Date(),
    }));
    const result = await svc.checkIn(
      event._id,
      volunteerId,
      svc.buildQrPayload(event._id, token),
    );
    assert.equal(result.status, "already_checked_in");
  });

  test("refuses unknown or no-longer-approved tokens", async () => {
    mock.method(EventRegistration, "findOneAndUpdate", async () => null);
    mock.method(EventRegistration, "findOne", async () => ({ status: "rejected" }));
    await rejectsWith(
      svc.checkIn(event._id, volunteerId, svc.buildQrPayload(event._id, token)),
      404,
    );
  });
});

describe("approve and reject", () => {
  const eventId = id();
  const regId = id();

  test("approval fails when the event is full", async () => {
    mock.method(EventRegistration, "findOne", async () => ({ status: "pending" }));
    mock.method(Event, "findOneAndUpdate", async () => null);
    const update = mock.method(EventRegistration, "findOneAndUpdate", async () => null);

    await rejectsWith(svc.approveRegistration(eventId, regId), 409, /full/);
    assert.equal(update.mock.callCount(), 0);
  });

  test("approval issues a token", async () => {
    mock.method(EventRegistration, "findOne", async () => ({ status: "pending" }));
    mock.method(Event, "findOneAndUpdate", async () => ({}));
    const update = mock.method(EventRegistration, "findOneAndUpdate", async (f, u) => ({
      status: u.$set.status,
      qrToken: u.$set.qrToken,
    }));

    const reg = await svc.approveRegistration(eventId, regId);
    assert.equal(reg.status, "approved");
    assert.match(reg.qrToken, /^[a-f0-9]{48}$/);
    assert.equal(update.mock.callCount(), 1);
  });

  test("rejecting an approved registration frees its seat", async () => {
    mock.method(EventRegistration, "findOneAndUpdate", async () => ({ status: "approved" }));
    mock.method(EventRegistration, "findById", async () => ({ status: "rejected" }));
    const release = mock.method(Event, "updateOne", async () => ({}));

    const reg = await svc.rejectRegistration(eventId, regId);
    assert.equal(reg.status, "rejected");
    assert.equal(release.mock.callCount(), 1);
  });

  test("cannot reject someone who already entered", async () => {
    mock.method(EventRegistration, "findOneAndUpdate", async () => null);
    mock.method(EventRegistration, "findOne", async () => ({ checkedInAt: new Date() }));
    await rejectsWith(svc.rejectRegistration(eventId, regId), 400, /already entered/);
  });
});

describe("toStudentEvent", () => {
  test("only exposes the QR for approved registrations", () => {
    const event = makeEvent({ capacity: 10, approvedCount: 4 });
    const userId = id();
    const pending = svc.toStudentEvent(event, { event: event._id, status: "pending", qrToken: "x" }, userId);
    assert.equal(pending.myRegistration.qrPayload, null);
    assert.equal(pending.seatsLeft, 6);

    const token = svc.generateQrToken();
    const approved = svc.toStudentEvent(event, { event: event._id, status: "approved", qrToken: token }, userId);
    assert.equal(approved.myRegistration.qrPayload, svc.buildQrPayload(event._id, token));
    assert.equal(approved.isVolunteer, false);
  });
});

describe("volunteer access code", () => {
  let event;
  beforeEach(() => {
    event = makeEvent({ volunteerCode: "K7XQ9M" });
    mock.method(Event, "findById", async () => event);
  });

  test("generated codes are 6 unambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      assert.match(generateVolunteerCode(), /^[A-HJKMNP-Z2-9]{6}$/);
    }
  });

  test("correct code adds the user as a volunteer (case and spaces ignored)", async () => {
    const add = mock.method(Event, "updateOne", async () => ({}));
    const userId = id();
    await svc.joinAsVolunteer(event._id, userId, " k7x q9m ");
    const [filter, update] = add.mock.calls[0].arguments;
    assert.equal(filter._id, event._id);
    assert.equal(update.$addToSet.volunteers, userId);
  });

  test("wrong or missing code is refused", async () => {
    const add = mock.method(Event, "updateOne", async () => ({}));
    await rejectsWith(svc.joinAsVolunteer(event._id, id(), "K7XQ9N"), 403, /Incorrect/);
    await rejectsWith(svc.joinAsVolunteer(event._id, id(), ""), 403);
    await rejectsWith(svc.joinAsVolunteer(event._id, id(), undefined), 403);
    assert.equal(add.mock.callCount(), 0);
  });

  test("existing volunteers don't need the code again", async () => {
    const userId = id();
    event.volunteers = [userId];
    const add = mock.method(Event, "updateOne", async () => ({}));
    await svc.joinAsVolunteer(event._id, userId, "nope");
    assert.equal(add.mock.callCount(), 0);
  });

  test("HAB can set its own code or generate one", async () => {
    mock.method(Event, "findByIdAndUpdate", async (_id, update) => ({
      volunteerCode: update.$set.volunteerCode,
    }));
    assert.equal(await svc.setVolunteerCode(event._id, " fest 2026 "), "FEST2026");
    assert.match(await svc.setVolunteerCode(event._id), /^[A-HJKMNP-Z2-9]{6}$/);
    await rejectsWith(svc.setVolunteerCode(event._id, "ab"), 400);
    await rejectsWith(svc.setVolunteerCode(event._id, "no-dashes!"), 400);
  });

  test("the code is never part of the student view", () => {
    const view = svc.toStudentEvent(event, null, id());
    assert.equal("volunteerCode" in view, false);
    assert.equal(JSON.stringify(view).includes("K7XQ9M"), false);
  });
});
