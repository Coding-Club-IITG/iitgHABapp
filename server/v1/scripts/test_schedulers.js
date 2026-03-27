const Module = require("module");
const path = require("path");
const dotenv = require("dotenv");
const schedule = require("node-schedule");

dotenv.config({ path: path.resolve(__dirname, "../../../server/.env") });

// 1. TIME MACHINE
const TARGET_DATE = "2026-03-28T12:00:00+05:30";
const OriginalDate = Date;
const timeOffset = new Date(TARGET_DATE).getTime() - OriginalDate.now();

let isTimeTravelActive = false;

function applyTimeMachine() {
  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new OriginalDate(OriginalDate.now() + timeOffset);
      }
      return new OriginalDate(...args);
    }
  };
  global.Date.now = () => OriginalDate.now() + timeOffset;
}

function restoreRealTime() {
  global.Date = OriginalDate;
}

// 2. SAFEGUARD: Firebase OAuth Bypass
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request.includes("notificationController")) {
    const actualController = originalRequire.apply(this, arguments);
    const wrappedController = {};

    for (const [key, func] of Object.entries(actualController)) {
      if (typeof func === "function") {
        wrappedController[key] = async (...args) => {
          const wasActive = isTimeTravelActive;
          isTimeTravelActive = false;

          if (wasActive) restoreRealTime();

          try {
            return await func(...args);
          } finally {
            isTimeTravelActive = wasActive;
            if (wasActive) applyTimeMachine();
          }
        };
      } else {
        wrappedController[key] = actualController[key];
      }
    }
    return wrappedController;
  }
  return originalRequire.apply(this, arguments);
};

// 3. START SERVER
console.log("🚀 Booting server...");
require("../index.js");

// 4. ACTIVATE TIME TRAVEL & TRIGGER SCHEDULERS
setTimeout(async () => {
  isTimeTravelActive = true;
  applyTimeMachine(); // Override the clock AFTER the app is fully loaded

  console.log("\n=======================================================");
  console.log("🛸 TIME MACHINE ACTIVATED!");
  console.log(`Server is now operating on: ${new Date().toLocaleString()}`);

  console.log("\n⚙️  Forcing Schedulers to evaluate the new timeline...");
  for (const [jobName, job] of Object.entries(schedule.scheduledJobs)) {
    await job.invoke();
  }

  console.log("✅ Schedulers ran successfully! Database is updated.");
  console.log("=======================================================\n");
}, 3000);
