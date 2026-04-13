import mongoose from "mongoose";

import { Mess } from "../modules/mess/messModel.js";

import { mongodbUri } from "../config/default.js";

/**
 * Reads rating, rank, and subscriber feedback % from all Mess documents.
 */
async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongodbUri);
  console.log("Connected successfully.");

  const rows = await Mess.find({})
    .select({ name: 1, rating: 1, ranking: 1, feedbackPercentage: 1 })
    .lean();

  rows.sort((a, b) => {
    const ar = Number(a.ranking) || 0;
    const br = Number(b.ranking) || 0;
    const as = ar === 0 ? 1_000_000 : ar;
    const bs = br === 0 ? 1_000_000 : br;
    if (as !== bs) return as - bs;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  for (const r of rows) {
    const rating = r.rating != null ? Number(r.rating) : 0;
    const rank = r.ranking != null ? Number(r.ranking) : 0;
    const fb = r.feedbackPercentage != null ? Number(r.feedbackPercentage) : 0;
    console.log(
      `${r._id}\t${String(r.name || "").replace(/\t/g, " ")}\t${rating}\t${rank}\t${fb}`,
    );
  }

  await mongoose.connection.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
