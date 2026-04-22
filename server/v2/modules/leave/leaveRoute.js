import express from "express";

import {
  authenticateJWT,
  authenticateMessManagerJWT,
  authenticateAdminJWT,
} from "../../middleware/authenticateJWT.js";

import { uploadSingleToOnedrive, sendDocument } from "./OnedriveController.js";
import {
  uploadMiddleware,
  applyForLeave,
  getApplications,
  getApplicationByID,
  streamMyProofDocument,
  validateUploadDoc,
  uploadDocForMedicalLeave,
  cancelApplication,
  getMessApplications,
  getApplicationSummary,
  acknowledgeRebateApplication,
  getSemesterAcknowledgedRebateApplications,
  streamHostelLeaveDocument,
  validateApply,
  validateGenerateFormOnly,
  generateStationLeaveFormOnly,
} from "./leaveController.js";
import { runMessRebateJob } from "./autoMessRebateScheduler.js";

const leaveRouter = express.Router();

// User/Student Endpoint

leaveRouter.post("/testScheduler", runMessRebateJob);

leaveRouter.post(
  "/apply",
  authenticateJWT,
  uploadMiddleware,
  validateApply,
  applyForLeave,
);

/** PDF only - no Leave document, no bank/proof (student hostel form). */
leaveRouter.post(
  "/generate-form-only",
  authenticateJWT,
  uploadMiddleware,
  validateGenerateFormOnly,
  generateStationLeaveFormOnly,
);

leaveRouter.get("/my-applications", authenticateJWT, getApplications);

leaveRouter.get(
  "/my-applications/:id/proof-document",
  authenticateJWT,
  streamMyProofDocument,
);

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

// Hostel Office Endpoints
leaveRouter.get(
  "/hostel/applications/:id/document",
  authenticateAdminJWT,
  streamHostelLeaveDocument,
);

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

// Hostel office: semester-wise acknowledged, unprocessed applications
leaveRouter.get(
  "/hostel/semester-rebate-applications",
  authenticateAdminJWT,
  getSemesterAcknowledgedRebateApplications,
);

leaveRouter.post(
  "/hostel/applications/:id/acknowledge",
  authenticateMessManagerJWT,
  acknowledgeRebateApplication,
);

leaveRouter.post("/download", authenticateMessManagerJWT, sendDocument);

export default leaveRouter;
