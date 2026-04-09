const express = require("express");

const {
  authenticateJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT.js");
const { uploadSingleToOnedrive , sendDocument } = require('./OnedriveController.js')

const {
  uploadMiddleware,
  applyForLeave,
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
  validateApply,
} = require("./leaveController.js");

const leaveRouter = express.Router();

//User/Student Endpoint

leaveRouter.post('/apply', authenticateJWT, uploadMiddleware, validateApply, applyForLeave);

leaveRouter.get('/my-applications', authenticateJWT, getApplications);

leaveRouter.get('/:id', authenticateJWT, getApplicationByID);

leaveRouter.get('/:id/proof', authenticateJWT, getApplicationProof);

leaveRouter.post('/my-applications/:id/upload-late-medical-document', authenticateJWT, validateUploadDoc , uploadMiddleware, uploadSingleToOnedrive, uploadDocForMedicalLeave )

leaveRouter.delete('/my-applications/:id', authenticateJWT, cancelApplication)

//Hostel Office Endpoints
leaveRouter.get('/hostel/pending', authenticateMessManagerJWT, getAllPendingApplications);

leaveRouter.get('/hostel/all', authenticateMessManagerJWT, filterApplications);

leaveRouter.post('/:id/approve', authenticateMessManagerJWT, approveApplication);

leaveRouter.post('/:id/reject', authenticateMessManagerJWT, rejectApplication);

leaveRouter.get('/hostel/rebate-summary', authenticateMessManagerJWT, getRebateSummary);

leaveRouter.post('/download',authenticateMessManagerJWT,sendDocument);

module.exports = leaveRouter;
