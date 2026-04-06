const express = require("express");
const { getStatus, scan, getHostelDashboard } = require("./laundryController.js");
const { authenticateJWT, authenticateAdminJWT } = require("../../middleware/authenticateJWT.js");

const laundryRouter = express.Router();

laundryRouter.get("/status", authenticateJWT, getStatus);
laundryRouter.post("/scan", authenticateJWT, scan);

laundryRouter.get("/hostel/dashboard", authenticateAdminJWT, getHostelDashboard);

module.exports = laundryRouter;
