import express from "express";
const feedbackRouter = express.Router();

import {
  submitFeedback,
  getFeedbackSettings,
  getFeedbackLeaderboardByWindow,
  getAvailableWindows,
  checkFeedbackSubmitted,
  getFeedbackWindowTimeLeft,
  getFeedbacksByCaterer,
  getDetailedFeedbackByWindow,
  getFeedbackScheduleInfo,
} from "./feedbackController.js";

import {
  authenticateJWT,
  authenticateHabJWT,
} from "../../middleware/authenticateJWT.js";
import { requireMicrosoftAuth } from "../../middleware/requireMicrosoftAuth.js";

// Student routes - require Microsoft account linking
feedbackRouter.post(
  "/submit",
  authenticateJWT,
  requireMicrosoftAuth,
  submitFeedback,
);
feedbackRouter.get(
  "/submitted",
  authenticateJWT,
  requireMicrosoftAuth,
  checkFeedbackSubmitted,
);

// Settings route (common, unprotected)
feedbackRouter.get("/settings", getFeedbackSettings);

// HAB routes
feedbackRouter.get("/schedule", authenticateHabJWT, getFeedbackScheduleInfo);
feedbackRouter.get(
  "/leaderboard-by-window",
  authenticateHabJWT,
  getFeedbackLeaderboardByWindow,
);
feedbackRouter.get("/windows", authenticateHabJWT, getAvailableWindows);
feedbackRouter.get("/window-time-left", getFeedbackWindowTimeLeft);
feedbackRouter.get("/by-caterer", authenticateHabJWT, getFeedbacksByCaterer);
feedbackRouter.get(
  "/detailed-by-window",
  authenticateHabJWT,
  getDetailedFeedbackByWindow,
);

export default feedbackRouter;
