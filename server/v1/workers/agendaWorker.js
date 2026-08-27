import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { mongodbUri } from "../config/default.js";
import agenda from "../utils/agenda.js";
import installProcessHandlers from "../../processHandlers.js";
import {
  agendaLifecycleLogger,
  configureLogging,
  flushLogging,
  logger,
} from "../logging/logger.js";

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

configureLogging("hab-worker-agenda-v1");
installProcessHandlers({ logger, flush: flushLogging });

async function bootstrap() {
  agendaLifecycleLogger.info("Agenda worker starting", {
    attributes: { component: "agenda", operation: "startup", outcome: "started" },
  });
  await mongoose.connect(mongodbUri);
  logger.info("Agenda worker MongoDB connected", {
    attributes: { component: "database", dependency: "mongodb", outcome: "success" },
  });

  logger.info("Agenda scheduler starting");
  agenda.on("success", (job) => {
    agendaLifecycleLogger.info("Agenda job completed", {
      correlationId: randomUUID(),
      attributes: {
        component: "agenda",
        jobName: job.attrs.name,
        operation: "execute",
        outcome: "success",
      },
    });
  });
  agenda.on("fail", (error, job) => {
    agendaLifecycleLogger.error("Agenda job failed", {
      error,
      correlationId: randomUUID(),
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

  logger.info("Agenda jobs scheduling");
  scheduleFeedbackJobs();
  scheduleMessChangeJobs();
  scheduleMessAllotmentJobs();
  scheduleMessRebateJobs();
  scheduleRoomCleaningJobs();
  scheduleGuestCleanupJobs();
  scheduleFestivalModeJobs();
  scheduleSummerMessJobs();

  agendaLifecycleLogger.info("Agenda worker ready", {
    attributes: { component: "agenda", operation: "startup", outcome: "success" },
  });
}

bootstrap().catch((err) => {
  agendaLifecycleLogger.fatal("Agenda worker startup failed", {
    error: err,
    attributes: { component: "agenda", operation: "startup", outcome: "failure" },
  });
  void flushLogging().finally(() => process.exit(1));
});

// Graceful shutdown
let shuttingDown = false;
async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  let shutdownFailed = false;
  let shutdownError;
  agendaLifecycleLogger.info("Agenda worker stopping", {
    attributes: { component: "agenda", operation: "shutdown", outcome: "started" },
  });
  try {
    await agenda.stop();
    logger.info("Agenda scheduler stopped");
  } catch (err) {
    shutdownFailed = true;
    shutdownError ??= err;
    logger.error("Agenda scheduler shutdown failed", { error: err });
  }

  try {
    await mongoose.connection.close();
    logger.info("Agenda MongoDB connection closed");
  } catch (err) {
    shutdownFailed = true;
    shutdownError ??= err;
    logger.error("Agenda MongoDB shutdown failed", { error: err });
  }
  const details = {
    ...(shutdownFailed ? { error: shutdownError } : {}),
    attributes: {
      component: "agenda",
      operation: "shutdown",
      outcome: shutdownFailed ? "failure" : "success",
    },
  };
  if (shutdownFailed) agendaLifecycleLogger.error("Agenda worker shutdown failed", details);
  else agendaLifecycleLogger.info("Agenda worker stopped", details);
  await flushLogging();
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
