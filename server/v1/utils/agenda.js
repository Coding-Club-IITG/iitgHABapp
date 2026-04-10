const { Agenda } = require("agenda");
const { MongoBackend } = require("@agendajs/mongo-backend");

/**
 * Singleton Agenda instance shared by all scheduler modules
 * Agenda persists every job in MongoDB (collection: "agendaJobs")
 */

const agenda = new Agenda({
  backend: new MongoBackend({
    address: process.env.MONGODB_URI,
    collection: "agendaJobs",
  }),

  // How often Agenda queries MongoDB for due jobs (ms)
  // 5 000 ms is fine for jobs that fire at minute-level precision
  processEvery: "5 seconds",

  // Maximum concurrent jobs across all queues on this process
  maxConcurrency: 4,

  // Lock lifetime: if a job hasn't finished in 10 minutes, release the lock
  // so another instance can pick it up
  defaultLockLifetime: 10 * 60 * 1000,
});

// Surface Agenda errors so they don't disappear silently
agenda.on("error", (err) => {
  console.error("[Agenda] Internal error:", err);
});

agenda.on("ready", () => {
  console.log("[Agenda] Connected to MongoDB job store");
});

module.exports = agenda;
