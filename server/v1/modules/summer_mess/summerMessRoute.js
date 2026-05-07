import express from "express";

import {
  authenticateJWT,
  authenticateHabJWT,
  authenticateMessManagerJWT,
} from "../../middleware/authenticateJWT.js";

import {
  acknowledgeSummerMessApplication,
  activateSummerMess,
  cancelSummerMessApplication,
  closeSummerMessRegistration,
  getManagerSummerMessApplications,
  getSummerMessAdminSettings,
  getSummerMessStatus,
  openSummerMessRegistration,
  registerForSummerMess,
  restoreSummerMess,
  streamManagerSummerMessProof,
  streamStudentSummerMessProof,
  upsertSummerMessAdminSettings,
  deleteSummerMessSeason,
} from "./summerMessController.js";
import {
  summerMessUploadMiddleware,
  uploadSummerMessProofToOnedrive,
} from "./summerMessUploadController.js";

const summerMessRouter = express.Router();

summerMessRouter.get("/status", authenticateJWT, getSummerMessStatus);
summerMessRouter.post(
  "/register",
  authenticateJWT,
  summerMessUploadMiddleware,
  uploadSummerMessProofToOnedrive,
  registerForSummerMess,
);
summerMessRouter.delete(
  "/my-applications/:id",
  authenticateJWT,
  cancelSummerMessApplication,
);

summerMessRouter.get(
  "/manager/applications",
  authenticateMessManagerJWT,
  getManagerSummerMessApplications,
);
summerMessRouter.post(
  "/manager/applications/:id/acknowledge",
  authenticateMessManagerJWT,
  acknowledgeSummerMessApplication,
);
summerMessRouter.get(
  "/manager/applications/:id/proof-document",
  authenticateMessManagerJWT,
  streamManagerSummerMessProof,
);

// Student-facing proof download (proxies OneDrive using server delegated token)
summerMessRouter.get(
  "/my-applications/:id/proof-document",
  authenticateJWT,
  streamStudentSummerMessProof,
);

summerMessRouter.get("/settings", authenticateHabJWT, getSummerMessAdminSettings);
summerMessRouter.post("/settings", authenticateHabJWT, upsertSummerMessAdminSettings);
summerMessRouter.post(
  "/settings/open-registration",
  authenticateHabJWT,
  openSummerMessRegistration,
);
summerMessRouter.post(
  "/settings/close-registration",
  authenticateHabJWT,
  closeSummerMessRegistration,
);
summerMessRouter.post("/activate", authenticateHabJWT, activateSummerMess);
summerMessRouter.post("/restore", authenticateHabJWT, restoreSummerMess);

// Admin: delete season and all its applications
summerMessRouter.delete(
  "/settings/:id",
  authenticateHabJWT,
  deleteSummerMessSeason,
);

export default summerMessRouter;
