import express from "express";

import {
  statsByDate,
  getTotalScanLogsCount,
  getManagerTodaySummary,
  managerAddOngoingMealScan,
  managerCreateScanEntry,
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

// Mess-manager (HABit HQ): manually add a scan for the ongoing meal (by rollNumber)
scanLogsRouter.post(
  "/manager/scan",
  authenticateMessManagerJWT,
  managerAddOngoingMealScan,
);

// Mess-manager (HABit HQ): add scan log for selected user/date/meal
scanLogsRouter.post(
  "/manager/entry",
  authenticateMessManagerJWT,
  managerCreateScanEntry,
);
// scanLogsRouter.post("/make", createLogs)
// scanLogsRouter.delete("/delete", deleteall)

export default scanLogsRouter;
