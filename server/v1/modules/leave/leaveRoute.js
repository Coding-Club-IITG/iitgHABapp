const express = require("express");

const {
  authenticateJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT.js");

const {
  uploadSingleToOnedrive,
  sendDocument,
} = require("./OnedriveController.js");

const {
  uploadMiddleware,
  applyForLeave,
  getApplications,
  getApplicationByID,
  validateUploadDoc,
  uploadDocForMedicalLeave,
  cancelApplication,
  getMessApplications,
  getApplicationSummary,
  acknowledgeRebateApplication,
  validateApply,
  validateGenerateFormOnly,
  generateStationLeaveFormOnly,
} = require("./leaveController.js");

const { runMessRebateJob } = require("./autoMessRebateScheduler.js");

const leaveRouter = express.Router();

//User/Student Endpoint

leaveRouter.post("/testScheduler", runMessRebateJob);

leaveRouter.post(
  "/apply",
  authenticateJWT,
  uploadMiddleware,
  validateApply,
  applyForLeave,
);

/** PDF only — no Leave document, no bank/proof (student hostel form). */
leaveRouter.post(
  "/generate-form-only",
  authenticateJWT,
  uploadMiddleware,
  validateGenerateFormOnly,
  generateStationLeaveFormOnly,
);

leaveRouter.get("/my-applications", authenticateJWT, getApplications);

leaveRouter.get("/:id", authenticateJWT, getApplicationByID);

leaveRouter.post(
  "/my-applications/:id/upload-late-medical-document",
  authenticateJWT,
  validateUploadDoc,
  uploadMiddleware,
  uploadSingleToOnedrive,
  uploadDocForMedicalLeave,
);

leaveRouter.delete("/my-applications/:id", authenticateJWT, cancelApplication);

//Hostel Office Endpoints
leaveRouter.get(
  "/hostel/mess-applications",
  authenticateMessManagerJWT,
  getMessApplications,
);

leaveRouter.get(
  "/hostel/application-summary",
  authenticateMessManagerJWT,
  getApplicationSummary,
);

leaveRouter.post(
  "/hostel/applications/:id/acknowledge",
  authenticateMessManagerJWT,
  acknowledgeRebateApplication,
);

leaveRouter.post("/download", authenticateMessManagerJWT, sendDocument);

module.exports = leaveRouter;
