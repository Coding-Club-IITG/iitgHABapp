const express = require("express");

const {
  statsByDate,
  getTotalScanLogsCount,
  getManagerTodaySummary,
  // createLogs,
  // deleteall
} = require("./ScanLogsController");
const {
  authenticateHabJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT");

const scanLogsRouter = express.Router();

scanLogsRouter.get("/get/:date", authenticateHabJWT, statsByDate);
scanLogsRouter.get("/total", authenticateHabJWT, getTotalScanLogsCount);
// Mess-manager (HABit HQ): today's summary for manager's mess
scanLogsRouter.get(
  "/manager/today",
  authenticateMessManagerJWT,
  getManagerTodaySummary,
);
// scanLogsRouter.post("/make", createLogs)
// scanLogsRouter.delete("/delete", deleteall)

module.exports = scanLogsRouter;
