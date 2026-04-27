import mongoose from "mongoose";
import { mongodbUri } from "../config/default.js";
import agenda from "../utils/agenda.js";

import {
  defineFeedbackJobs,
  scheduleFeedbackJobs,
} from "../modules/feedback/autoFeedbackScheduler.js";
import {
  defineMessChangeJobs,
  scheduleMessChangeJobs,
} from "../modules/mess_change/autoMessChangeScheduler.js";
import {
  defineMessAllotmentJobs,
  scheduleMessAllotmentJobs,
} from "../modules/mess_change/allotmentScheduler.js";
import {
  defineMessRebateJobs,
  scheduleMessRebateJobs,
} from "../modules/leave/autoMessRebateScheduler.js";
import {
  defineRoomCleaningJobs,
  scheduleRoomCleaningJobs,
} from "../modules/room_cleaning/autoRoomCleaningResolveScheduler.js";
import {
  defineFestivalModeJobs,
  scheduleFestivalModeJobs,
} from "../modules/festival_mode/autoFestivalModeDisableScheduler.js";
import {
  defineGuestCleanupJobs,
  scheduleGuestCleanupJobs,
} from "../modules/auth/autoGuestCleanupScheduler.js";

async function bootstrap() {
  await mongoose.connect(mongodbUri);
  console.log("[Agenda Worker] MongoDB connected");

  console.log("[Agenda Worker] Starting Agenda...");
  await agenda.start();
  defineFeedbackJobs();
  defineMessChangeJobs();
  defineMessAllotmentJobs();
  defineMessRebateJobs();
  defineRoomCleaningJobs();
  defineGuestCleanupJobs();
  defineFestivalModeJobs();

  console.log("[Agenda Worker] Scheduling jobs...");
  scheduleFeedbackJobs();
  scheduleMessChangeJobs();
  scheduleMessAllotmentJobs();
  scheduleMessRebateJobs();
  scheduleRoomCleaningJobs();
  scheduleGuestCleanupJobs();
  scheduleFestivalModeJobs();

  console.log("[Agenda Worker] Ready");
}

bootstrap().catch((err) => {
  console.error("[Agenda Worker] Bootstrap failed:", err);
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  try {
    await agenda.stop();
    console.log("[Agenda Worker] ✅ Agenda stopped");
  } catch (err) {
    console.error("[Agenda Worker] ❌ Agenda stop error:", err);
  }

  try {
    await mongoose.connection.close();
    console.log("[Agenda Worker] ✅ Mongoose connection closed");
  } catch (err) {
    console.error("[Agenda Worker] ❌ Mongoose close error:", err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
