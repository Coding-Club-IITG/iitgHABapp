import crypto from "crypto";

import { SummerMessAutomationLock } from "./summerMessAutomationLockModel.js";

const LOCK_KEY = "summer-mess-transition";
const LOCK_TTL_MS = 4 * 60 * 1000;

export class SummerMessAutomationLockedError extends Error {
  constructor(message = "Summer mess automation is already running") {
    super(message);
    this.name = "SummerMessAutomationLockedError";
  }
}

async function acquireSummerMessAutomationLock() {
  const now = new Date();
  const owner = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

  const updateResult = await SummerMessAutomationLock.updateOne(
    {
      key: LOCK_KEY,
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        owner,
        expiresAt,
      },
    },
    { upsert: false },
  );

  if (updateResult.modifiedCount === 1) {
    return owner;
  }

  const existing = await SummerMessAutomationLock.findOne({ key: LOCK_KEY })
    .select("expiresAt")
    .lean();
  if (!existing) {
    try {
      await SummerMessAutomationLock.create({ key: LOCK_KEY, owner, expiresAt });
      return owner;
    } catch (error) {
      if (error?.code === 11000) {
        throw new SummerMessAutomationLockedError();
      }
      throw error;
    }
  }

  throw new SummerMessAutomationLockedError();
}

async function releaseSummerMessAutomationLock(owner) {
  if (!owner) return;

  await SummerMessAutomationLock.updateOne(
    { key: LOCK_KEY, owner },
    {
      $set: {
        owner: null,
        expiresAt: null,
      },
    },
  );
}

export async function withSummerMessAutomationLock(task) {
  const owner = await acquireSummerMessAutomationLock();
  try {
    return await task();
  } finally {
    await releaseSummerMessAutomationLock(owner);
  }
}
