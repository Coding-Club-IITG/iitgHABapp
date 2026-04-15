/**
 * Singleton Agenda instance shared by all scheduler modules
 * Jobs persist in MongoDB (collection: "agendaJobs")
 * Redis handles real-time job notifications to reduce MongoDB polling load
 */
import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import { RedisNotificationChannel } from "@agendajs/redis-backend";
import { mongodbUri, redisUrl, API_VERSION } from "../config/default.js";

const agenda = new Agenda({
  backend: new MongoBackend({ address: mongodbUri, collection: `agendaJobs_${API_VERSION}` }),
  notificationChannel: new RedisNotificationChannel({
    connectionString: redisUrl,
  }),

  processEvery: "30 seconds",
  maxConcurrency: 4,
  defaultLockLifetime: 10 * 60 * 1000,
});

// Surface Agenda errors so they don't disappear silently
agenda.on("error", (err) => {
  console.error("[Agenda] Internal error:", err);
});

agenda.on("ready", () => {
  console.log("[Agenda] Connected to MongoDB job store");
});

export default agenda;
