import express from "express";

import { getStatus, scan, getHostelDashboard } from "./laundryController.js";

import {
  authenticateJWT,
  authenticateAdminJWT,
} from "../../middleware/authenticateJWT.js";

const laundryRouter = express.Router();

laundryRouter.get("/status", authenticateJWT, getStatus);
laundryRouter.post("/scan", authenticateJWT, scan);

laundryRouter.get(
  "/hostel/dashboard",
  authenticateAdminJWT,
  getHostelDashboard,
);

export default laundryRouter;
