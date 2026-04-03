// alert/alertRoute.js

const express = require("express");
const router = express.Router();
const {
  authenticateJWT,
  authenticateHabOrSMCJWT,
} = require("../../middleware/authenticateJWT");
const { createAlert, getAlerts } = require("./alertController");

router.post("/create", authenticateHabOrSMCJWT, createAlert);
router.get("/", authenticateJWT, getAlerts);

module.exports = router;
