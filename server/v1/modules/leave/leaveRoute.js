const express = require("express");

const {
  authenticateJWT,
  authenticateAdminJWT,
} = require("../../middleware/authenticateJWT.js");

const { uploadToOnedrive } = require('./uploadToOnedrive.js')

const {
  uploadMiddleware,
  applyForLeave,
  conditionalUpload,
  getApplications,
  getApplicationByID,
  getApplicationProof,
  validateUploadDoc,
  uploadDocForMedicalLeave,
  cancelApplication,
  getAllPendingApplications,
  filterApplications,
  approveApplication,
  rejectApplication,
  getRebateSummary,
  validateApply
} = require("./leaveController.js");

const leaveRouter = express.Router();

//User/Student Endpoint

leaveRouter.post('/apply', authenticateJWT, conditionalUpload, validateApply, applyForLeave);

leaveRouter.get('/my-applications', authenticateJWT, getApplications);

leaveRouter.get('/:id', authenticateJWT, getApplicationByID);

leaveRouter.get('/:id/proof', authenticateJWT, getApplicationProof);

leaveRouter.post('/:id/upload-late-medical-document', authenticateJWT, validateUploadDoc , uploadMiddleware, uploadToOnedrive, uploadDocForMedicalLeave )

leaveRouter.get('/:id/cancel-application', authenticateJWT, cancelApplication)

//Hostel Office Endpoints
leaveRouter.get('/hostel/pending', authenticateAdminJWT, getAllPendingApplications);

leaveRouter.get('/hostel/all', authenticateAdminJWT, filterApplications);

leaveRouter.post('/:id/approve', authenticateAdminJWT, approveApplication);

leaveRouter.post('/:id/reject', authenticateAdminJWT, rejectApplication);

leaveRouter.get('/hostel/rebate-summary', authenticateAdminJWT, getRebateSummary);

module.exports = leaveRouter;
