import UserAllocHostel from "../hostel/hostelAllocModel.js";
import { MessSubscribersSnapshot } from "./messSubscribersSnapshotModel.js";

/**
 * Snapshot all mess subscribers for a given month/year.
 * Source of truth: UserAllocHostel (hostel + current_subscribed_mess).
 *
 * Creates one document per subscribed mess hostel (hostelId).
 * Idempotent: will NOT overwrite existing snapshots.
 */
export async function snapshotMessSubscribersByHostel({ month, year }) {
  const allAllocs = await UserAllocHostel.find({
    hostel: { $ne: null },
    current_subscribed_mess: { $ne: null },
    rollno: { $ne: null },
  })
    .populate("hostel", "hostel_name")
    .populate("current_subscribed_mess", "hostel_name")
    .lean();

  const byMessHostel = new Map();
  for (const a of allAllocs) {
    const messHostelId = String(a.current_subscribed_mess?._id || a.current_subscribed_mess);
    if (!messHostelId) continue;

    if (!byMessHostel.has(messHostelId)) byMessHostel.set(messHostelId, []);
    byMessHostel.get(messHostelId).push({
      rollNumber: String(a.rollno),
      boardingHostelId: a.hostel?._id || a.hostel || null,
      boardingHostelName: a.hostel?.hostel_name || "",
      subscribedMessHostelName: a.current_subscribed_mess?.hostel_name || "",
    });
  }

  const ops = [];
  for (const [messHostelId, subscribers] of byMessHostel.entries()) {
    ops.push({
      updateOne: {
        filter: { hostelId: messHostelId, month, year },
        update: {
          $setOnInsert: {
            hostelId: messHostelId,
            month,
            year,
            subscribers,
            totalCount: subscribers.length,
          },
        },
        upsert: true,
      },
    });
  }

  if (!ops.length) return { created: 0, totalHostels: 0 };

  const res = await MessSubscribersSnapshot.bulkWrite(ops, { ordered: false });
  const created = res.upsertedCount || 0;
  return { created, totalHostels: ops.length };
}

