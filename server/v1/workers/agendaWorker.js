import mongoose from "mongoose";
import { mongodbUri } from "../config/default.js";
import agenda from "../utils/agenda.js";
import { buildApplicationEvent } from "../telemetry/event.js";
import { closeOpsTelemetry, publishLogEvent } from "../telemetry/publisher.js";

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
import {
  defineSummerMessJobs,
  scheduleSummerMessJobs,
} from "../modules/summer_mess/autoSummerMessScheduler.js";

function emitWorkerEvent(input) {
  try {
    void publishLogEvent(buildApplicationEvent(input));
  } catch {
    // Invalid telemetry must never affect Agenda execution.
  }
}

async function bootstrap() {
  await publishLogEvent(
    buildApplicationEvent({
      level: "info",
      message: "Agenda worker starting",
      attributes: {
        component: "agenda",
        operation: "startup",
        outcome: "started",
      },
    }),
  );
  await mongoose.connect(mongodbUri);
  console.log("[Agenda Worker] MongoDB connected");

  console.log("[Agenda Worker] Starting Agenda...");
  agenda.on("success", (job) => {
    emitWorkerEvent({
      level: "info",
      message: "Agenda job completed",
      attributes: {
        component: "agenda",
        jobName: job.attrs.name,
        operation: "execute",
        outcome: "success",
      },
    });
  });
  agenda.on("fail", (_error, job) => {
    emitWorkerEvent({
      level: "error",
      message: "Agenda job failed",
      error: { name: "AgendaJobError", code: "JOB_FAILED" },
      attributes: {
        component: "agenda",
        jobName: job.attrs.name,
        operation: "execute",
        outcome: "failure",
        retryable: true,
      },
    });
  });

  await agenda.start();
  defineFeedbackJobs();
  defineMessChangeJobs();
  defineMessAllotmentJobs();
  defineMessRebateJobs();
  defineRoomCleaningJobs();
  defineGuestCleanupJobs();
  defineFestivalModeJobs();
  defineSummerMessJobs();

  console.log("[Agenda Worker] Scheduling jobs...");
  scheduleFeedbackJobs();
  scheduleMessChangeJobs();
  scheduleMessAllotmentJobs();
  scheduleMessRebateJobs();
  scheduleRoomCleaningJobs();
  scheduleGuestCleanupJobs();
  scheduleFestivalModeJobs();
  scheduleSummerMessJobs();

  console.log("[Agenda Worker] Ready");
  await publishLogEvent(
    buildApplicationEvent({
      level: "info",
      message: "Agenda worker ready",
      attributes: {
        component: "agenda",
        operation: "startup",
        outcome: "success",
      },
    }),
  );
}

bootstrap().catch((err) => {
  console.error("[Agenda Worker] Bootstrap failed:", err);
  void publishLogEvent(
    buildApplicationEvent({
      level: "fatal",
      message: "Agenda worker startup failed",
      error: { name: "WorkerStartupError", code: "STARTUP_FAILED" },
      attributes: {
        component: "agenda",
        operation: "startup",
        outcome: "failure",
      },
    }),
  ).finally(() => process.exit(1));
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  let shutdownFailed = false;
  await publishLogEvent(
    buildApplicationEvent({
      level: "info",
      message: "Agenda worker stopping",
      attributes: {
        component: "agenda",
        operation: "shutdown",
        outcome: "started",
      },
    }),
  );
  try {
    await agenda.stop();
    console.log("[Agenda Worker] ✅ Agenda stopped");
  } catch (err) {
    shutdownFailed = true;
    console.error("[Agenda Worker] ❌ Agenda stop error:", err);
  }

  try {
    await mongoose.connection.close();
    console.log("[Agenda Worker] ✅ Mongoose connection closed");
  } catch (err) {
    shutdownFailed = true;
    console.error("[Agenda Worker] ❌ Mongoose close error:", err);
  }
  await publishLogEvent(
    buildApplicationEvent({
      level: shutdownFailed ? "error" : "info",
      message: shutdownFailed
        ? "Agenda worker shutdown failed"
        : "Agenda worker stopped",
      ...(shutdownFailed
        ? { error: { name: "WorkerShutdownError", code: "SHUTDOWN_FAILED" } }
        : {}),
      attributes: {
        component: "agenda",
        operation: "shutdown",
        outcome: shutdownFailed ? "failure" : "success",
      },
    }),
  );
  await closeOpsTelemetry();
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
