import { logger } from "../../logging/logger.js";
import {
  uploadBufferToLeaveFolder,
  downloadFromOnedrive,
  makeUniqueMiddleName,
} from "../../utils/onedriveController.js";
import onedrive from "../../config/onedrive.js";

const LEAVE_FOLDER_ID = onedrive.leaveFolderId;

// Shared error handler

function handleUploadError(err, res, message) {
  logger.error("OneDrive operation failed", { error: err });
  const status = err.response?.status;
  const msg = err.response?.data?.error?.message || err.message;
  return res
    .status(status === 403 ? 403 : 500)
    .json({ message, error: msg, status });
}

// Multi-file upload middleware

export const uploadFilesToOnedrive = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      logger.info(
        "[OneDrive][uploadFilesToOnedrive] No files; skipping upload",
      );
      req.uploadedDocuments = {};
      return next();
    }

    if (!LEAVE_FOLDER_ID) {
      logger.error(
        "[OneDrive][uploadFilesToOnedrive] LEAVE_FOLDER_ID not configured; cannot upload",
      );
      return res
        .status(400)
        .json({ message: "ONEDRIVE_LEAVE_FOLDER_ID is not configured" });
    }

    const uniqueMiddleName = makeUniqueMiddleName(req.user._id);
    req.uploadedDocuments = {};
    logger.info("OneDrive document upload started");

    const proofDocument = req.files?.["proofDocument"]?.[0] ?? null;
    const leaveDocument = req.files?.["leaveDocument"]?.[0] ?? null;

    if (proofDocument) {
      req.uploadedDocuments.proofDocument = await uploadBufferToLeaveFolder(
        proofDocument.buffer,
        proofDocument.mimetype,
        `proofDocument${uniqueMiddleName}${proofDocument.originalname}`,
      );
    }
    if (leaveDocument) {
      req.uploadedDocuments.leaveDocument = await uploadBufferToLeaveFolder(
        leaveDocument.buffer,
        leaveDocument.mimetype,
        `leaveDocument${uniqueMiddleName}${leaveDocument.originalname}`,
      );
    }

    logger.info("OneDrive document uploads completed");
    next();
  } catch (err) {
    handleUploadError(err, res, "Failed to upload verification documents");
  }
};

// Single-file upload middleware

export async function uploadSingleToOnedrive(req, res, next) {
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

    const uniqueMiddleName = makeUniqueMiddleName(req.user._id);
    const proofDocument = req.files["proofDocument"][0];

    req.uploadedDocuments = {
      proofDocument: await uploadBufferToLeaveFolder(
        proofDocument.buffer,
        proofDocument.mimetype,
        `proofDocument${uniqueMiddleName}${proofDocument.originalname}`,
      ),
    };

    logger.info("OneDrive document upload completed");
    next();
  } catch (err) {
    handleUploadError(err, res, "Failed to upload medical documents");
  }
}

// Download endpoint

export const sendDocument = async (req, res) => {
  const { proofDocumentUrl } = req.body;
  if (!proofDocumentUrl) {
    return res.status(404).json({ message: "No document URL attached" });
  }
  try {
    await downloadFromOnedrive(proofDocumentUrl, res);
  } catch (err) {
    logger.error("[OneDrive] sendDocument error:", { error: err });
    return res.status(500).json({
      message: "Failed to fetch Proof Document",
      error: err.message,
      status: err.response?.status,
    });
  }
};
