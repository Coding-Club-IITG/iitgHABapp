/**
 * Singleton Agenda instance shared by all scheduler modules
 * Jobs persist in MongoDB (collection: "agendaJobs")
 */
import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import { mongodbUri } from "../config/default.js";

const agenda = new Agenda({
  backend: new MongoBackend({
    address: mongodbUri,
    collection: "agendaJobs",
  }),

  // How often MongoDB is queried for due jobs
  processEvery: "30 seconds",

  // Maximum concurrent jobs across all queues on this process
  maxConcurrency: 4,

  // If a job hasn't finished in 10 minutes, release the lock so another instance picks it up
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
