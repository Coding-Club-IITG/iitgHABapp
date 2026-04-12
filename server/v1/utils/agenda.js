/**
 * Singleton Agenda instance shared by all scheduler modules.
 * Agenda v4 is CommonJS-compatible; v6+ is ESM-only and breaks require().
 * Jobs persist in MongoDB (collection: "agendaJobs").
 */
const Agenda = require("agenda");

const agenda = new Agenda({
  db: {
    address: process.env.MONGODB_URI,
    collection: "agendaJobs",
  },
  processEvery: "5 seconds",
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

module.exports = agenda;
