import express from "express";

import {
  messChangeRequest,
  messChangeStatus,
} from "./controllers/requestController.js";
import {
  getAllMessChangeRequestsForAllHostels,
  messChangeStatusForAdmin,
  getMessChangeScheduleInfo,
} from "./controllers/adminController.js";

import {
  authenticateJWT,
  authenticateHabJWT,
} from "../../middleware/authenticateJWT.js";
import { requireMicrosoftAuth } from "../../middleware/requireMicrosoftAuth.js";

const messChangeRouter = express.Router();

// User routes - require Microsoft account linking
messChangeRouter.get(
  "/status",
  authenticateJWT,
  requireMicrosoftAuth,
  messChangeStatus,
);
messChangeRouter.post(
  "/reqchange",
  authenticateJWT,
  requireMicrosoftAuth,
  messChangeRequest,
);

// Admin routes
messChangeRouter.get(
  "/all",
  authenticateHabJWT,
  getAllMessChangeRequestsForAllHostels,
);
messChangeRouter.get("/settings", authenticateHabJWT, messChangeStatusForAdmin);
messChangeRouter.get(
  "/schedule",
  authenticateHabJWT,
  getMessChangeScheduleInfo,
);

export default messChangeRouter;
