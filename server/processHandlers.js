/**
 * Process-level error handlers to prevent silent crashes in production.
 * Import this once at the top of each entrypoint.
 *
 * Without these, a single unhandled promise rejection or uncaught exception
 * will exit the Node process; PM2 will restart it, but the app will keep
 * stopping until the root cause is fixed.
 */
const fallbackLogger = {
  error(message) {
    process.stderr.write(`${message}\n`);
  },
  fatal(message) {
    process.stderr.write(`${message}\n`);
  },
};

export default function installProcessHandlers({
  logger = fallbackLogger,
  flush = async () => {},
} = {}) {
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
      error: reason,
      attributes: {
        component: "process",
        operation: "promise",
        outcome: "failure",
      },
    });
    // Don't exit - let the process keep running. Fix the code that caused this.
  });

  process.on("uncaughtException", async (err) => {
    logger.fatal("Uncaught exception", {
      error: err,
      attributes: {
        component: "process",
        operation: "execute",
        outcome: "failure",
      },
    });
    await flush();
    process.exit(1);
  });
}
