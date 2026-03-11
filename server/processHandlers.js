/**
 * Process-level error handlers to prevent silent crashes in production.
 * Require this once at the top of each entry point (gateway, v1, v2).
 *
 * Without these, a single unhandled promise rejection or uncaught exception
 * will exit the Node process; PM2 will restart it, but the app will keep
 * stopping until the root cause is fixed.
 */
function installProcessHandlers() {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[CRASH PREVENTION] Unhandled Rejection at:", promise, "reason:", reason);
    // Don't exit - let the process keep running. Fix the code that caused this.
  });

  process.on("uncaughtException", (err) => {
    console.error("[CRASH PREVENTION] Uncaught Exception:", err);
    // Exit after logging so PM2 can restart a clean process.
    process.exit(1);
  });
}

module.exports = { installProcessHandlers };
