const axios = require("axios");
require("dotenv").config();
const {
  uploadToOnedrive,
  downloadFromOnedrive,
} = require("../../utils/onedriveController.js");

const LEAVE_FOLDER_ID = process.env.ONEDRIVE_LEAVE_FOLDER_ID;

const uploadFilesToOnedrive = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log(
        "[OneDrive][uploadFilesToOnedrive] No files on request; skipping upload",
      );
      req.uploadedDocuments = {};
      return next();
    }
    console.log(req.files);

    if (!LEAVE_FOLDER_ID) {
      console.error(
        "[OneDrive][uploadFilesToOnedrive] LEAVE_FOLDER_ID not configured; cannot upload",
      );
      return res
        .status(400)
        .json({ message: "ONEDRIVE_LEAVE_FOLDER_ID is not configured" });
    }
    const uniqueSuffix = Math.round(Math.random() * 1e9);

    const timeStamp = Date.now();

    const uniqueMiddleName = `-${req.user._id}-${timeStamp}-${uniqueSuffix}-`;
    req.uploadedDocuments = {};
    console.log(`Starting upload to onedrive for user: ${req.user?.name}`);
    const proofDocument = req.files?.["proofDocument"]?.[0] ?? null;
    const leaveDocument = req.files?.["leaveDocument"]?.[0];

    if (proofDocument) {
      req.uploadedDocuments.proofDocument = await uploadToOnedrive(
        proofDocument.buffer,
        proofDocument.mimetype,
        `proofdocument${uniqueMiddleName}${proofDocument.originalname}`,
        LEAVE_FOLDER_ID,
        res,
      );
    }
    if (leaveDocument) {
      req.uploadedDocuments.leaveDocument = await uploadToOnedrive(
        leaveDocument.buffer,
        leaveDocument.mimetype,
        `proofdocument${uniqueMiddleName}${leaveDocument.originalname}`,
        LEAVE_FOLDER_ID,
        res,
      );
    }

    console.log("OneDrive uploads successful", req.uploadedDocuments);
    next();
  } catch (err) {
    console.error(
      "[OneDrive][uploadFilesToOnedrive] OneDrive upload failed",
      err,
    );
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error?.message || err.message;
    return res.status(status === 403 ? 403 : 500).json({
      message: "Failed to upload verification documents",
      error: msg,
      status,
    });
  }
};

async function uploadSingleToOnedrive(req, res, next) {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      req.uploadedDocuments = {};
      return next();
    }

    if (!LEAVE_FOLDER_ID) {
      return res
        .status(400)
        .json({ message: "ONEDRIVE_LEAVE_FOLDER_ID is not configured" });
    }

    const uniqueSuffix = Math.round(Math.random() * 1e9);

    const timeStamp = Date.now();

    const uniqueMiddleName = `-${req.user._id}-${timeStamp}-${uniqueSuffix}-`;

    req.uploadedDocuments = {};
    console.log(`Starting upload to onedrive for user: ${req.user?.name}`);
    const proofDocument = req.files["proofDocument"][0];

    req.uploadedDocuments.proofDocument = await uploadToOnedrive(
      proofDocument.buffer,
      proofDocument.mimetype,
      `proofdocument${uniqueMiddleName}${proofDocument.originalname}`,
      LEAVE_FOLDER_ID,
      res,
    );

    console.log("OneDrive uploads successful", req.uploadedDocuments);
    next();
  } catch (err) {
    console.error("Addition of medical certificate failed:", err);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error?.message || err.message;
    return res.status(status === 403 ? 403 : 500).json({
      message: "Failed to upload medical documents",
      error: msg,
      status,
    });
  }
}

const sendDocument = async (req, res) => {
  const { proofDocumentUrl } = req.body;
  const documentUrl = proofDocumentUrl;
  try {
    if (!documentUrl) {
      return res.status(404).json({ message: "No document URL attached" });
    }

    if (documentUrl) {
      try {
        await downloadFromOnedrive(documentUrl, res);
      } catch (e) {
        console.error("Error in fetching document", e);
        return res.status(200).json({ url: proofDocumentUrl });
      }
    }
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch Proof Document",
      error: err.message,
      status: err.response?.status,
    });
  }
};

module.exports = {
  uploadSingleToOnedrive,
  sendDocument,
  uploadFilesToOnedrive,
};
