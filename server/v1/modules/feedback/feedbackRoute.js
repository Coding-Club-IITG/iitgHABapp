const express = require("express");
const feedbackRouter = express.Router();
const {
  submitFeedback,
  enableFeedback,
  disableFeedback,
  getFeedbackSettings,
  getFeedbackLeaderboardByWindow,
  getAvailableWindows,
  checkFeedbackSubmitted,
  getFeedbackWindowTimeLeft,
  getFeedbacksByCaterer,
} = require("./feedbackController");
const {
  authenticateJWT,
  authenticateHabJWT,
} = require("../../middleware/authenticateJWT");
const {
  requireMicrosoftAuth,
} = require("../../middleware/requireMicrosoftAuth");

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
feedbackRouter.post("/enable", authenticateHabJWT, enableFeedback);
feedbackRouter.post("/disable", authenticateHabJWT, disableFeedback);
feedbackRouter.get(
  "/leaderboard-by-window",
  authenticateHabJWT,
  getFeedbackLeaderboardByWindow,
);
feedbackRouter.get("/windows", authenticateHabJWT, getAvailableWindows);
feedbackRouter.get("/window-time-left", getFeedbackWindowTimeLeft);
feedbackRouter.get("/by-caterer", authenticateHabJWT, getFeedbacksByCaterer);

module.exports = feedbackRouter;
