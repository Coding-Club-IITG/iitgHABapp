// alert/alertRoute.js

const express = require("express");
const router = express.Router();
const { authenticateJWT, authenticateAdminJWT } = require("../../middleware/authenticateJWT");
const { createAlert, getAlerts } = require("./alertController");

router.post("/create", authenticateAdminJWT, createAlert);
router.get("/", authenticateJWT, getAlerts);

module.exports = router;
