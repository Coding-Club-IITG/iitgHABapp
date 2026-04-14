import path from "path";
import dotenv from "dotenv";
const __dirname = import.meta.dirname;

// Match backend config loading (.env at repo root)
dotenv.config({ path: path.join(__dirname, "../../.env") });

import mongoose from "mongoose";
import { mongodbUri } from "../config/default.js";
import { MessSettings } from "../modules/mess/messSettingsModel.js";

function parseArgs(argv) {
  const args = new Set(argv.slice(2).map((s) => s.trim()).filter(Boolean));
  const enable = args.has("--enable") || args.has("enable");
  const disable = args.has("--disable") || args.has("disable");
  const toggle = args.has("--toggle") || args.has("toggle") || args.size === 0;

  if ([enable, disable, toggle].filter(Boolean).length !== 1) {
    throw new Error(
      "Usage: node scripts/toggle_mess_rebate.js [--enable|--disable|--toggle]",
    );
  }

  return { enable, disable, toggle };
}

async function main() {
  try {
    const { enable, disable, toggle } = parseArgs(process.argv);

    if (!mongodbUri) {
      throw new Error("MONGODB_URI is not set");
    }

    console.log("[toggle_mess_rebate] Connecting to MongoDB...");
    await mongoose.connect(mongodbUri);

    let s = await MessSettings.findOne();
    if (!s) s = new MessSettings();

    const before = Boolean(s.messRebateEnabled);
    const after = enable ? true : disable ? false : !before;

    s.messRebateEnabled = after;
    await s.save();

    console.log(
      `[toggle_mess_rebate] ✅ messRebateEnabled: ${before} -> ${after}`,
    );
  } catch (e) {
    console.error("[toggle_mess_rebate] ❌ Failed:", e?.message || e);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.connection.close();
    } catch (_) {}
  }
}

main();

