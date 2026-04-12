/**
 * Reads rating, rank, and subscriber feedback % from all Mess documents.
 *
 * Usage: node server/v1/scripts/fetch_caterer_performance.js
 * Requires MONGODB_URI in server/.env
 */

const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../server/.env") });

const { Mess } = require("../modules/mess/messModel.js");

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

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
