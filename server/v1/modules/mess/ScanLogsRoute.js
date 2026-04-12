import express from "express";

import {
  statsByDate,
  getTotalScanLogsCount,
  getManagerTodaySummary,
  // createLogs,
  // deleteall
} from "./ScanLogsController.js";

import {
  authenticateHabJWT,
  authenticateMessManagerJWT,
} from "../../middleware/authenticateJWT.js";

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

export default scanLogsRouter;
