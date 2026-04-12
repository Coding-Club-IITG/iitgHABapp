const express = require("express");

// Import from modular controllers
const {
  messChangeRequest,
  messChangeStatus,
} = require("./controllers/requestController.js");

const {
  processAllMessChangeRequests,
  rejectAllMessChangeRequests,
} = require("./controllers/processingController.js");

const {
  getAllMessChangeRequestsForAllHostels,
  messChangeStatusForAdmin,
  enableMessChange,
  disableMessChange,
  getMessChangeScheduleInfo,
} = require("./controllers/adminController.js");

const {
  authenticateJWT,
  authenticateHabJWT,
} = require("../../middleware/authenticateJWT.js");
const {
  requireMicrosoftAuth,
} = require("../../middleware/requireMicrosoftAuth.js");

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
messChangeRouter.post(
  "/process-all",
  authenticateHabJWT,
  processAllMessChangeRequests,
);
messChangeRouter.post(
  "/reject-all",
  authenticateHabJWT,
  rejectAllMessChangeRequests,
);
messChangeRouter.get("/settings", authenticateHabJWT, messChangeStatusForAdmin);
messChangeRouter.get(
  "/schedule",
  authenticateHabJWT,
  getMessChangeScheduleInfo,
);
messChangeRouter.post("/enable", authenticateHabJWT, enableMessChange);
messChangeRouter.post("/disable", authenticateHabJWT, disableMessChange);

module.exports = messChangeRouter;
