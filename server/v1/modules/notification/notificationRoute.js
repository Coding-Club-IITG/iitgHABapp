import express from "express";
const router = express.Router();

import {
  authenticateJWT,
  authenticateAdminJWT,
  authenticateUserOrAdminJWT,
} from "../../middleware/authenticateJWT.js";

import {
  registerToken,
  sendNotification,
  sendWelcomeNotification,
} from "./notificationController.js";

// Send notification requires admin authentication (hostel office or HAB)
router.post("/send", authenticateUserOrAdminJWT, sendNotification);
router.post("/register-token", authenticateJWT, registerToken);
// Send welcome notification - called from frontend after FCM token registration
router.post("/welcome", authenticateJWT, sendWelcomeNotification);

export default router;
