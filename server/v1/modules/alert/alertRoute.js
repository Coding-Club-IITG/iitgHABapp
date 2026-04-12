import express from "express";
const router = express.Router();

import {
  authenticateJWT,
  authenticateHabOrSMCJWT,
} from "../../middleware/authenticateJWT.js";
import { createAlert, getAlerts } from "./alertController.js";

router.post("/create", authenticateHabOrSMCJWT, createAlert);
router.get("/", authenticateJWT, getAlerts);

export default router;
