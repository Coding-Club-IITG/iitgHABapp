import { logger } from "../../logging/logger.js";
import path from "path";
import multer from "multer";

import onedrive from "../../config/onedrive.js";
import {
  downloadFromOnedrive,
  makeUniqueMiddleName,
  uploadBufferToFolder,
} from "../../utils/onedriveController.js";

const SUMMER_MESS_FOLDER_ID = onedrive.summerMessFolderId;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("UNSUPPORTED_FILE_TYPE"));
  },
});

function uploadErrorResponse(res, message, error) {
  return res.status(400).json({
    message,
    error: error?.message || String(error || ""),
  });
}

export function summerMessUploadMiddleware(req, res, next) {
  upload.fields([{ name: "paymentProof", maxCount: 1 }])(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return uploadErrorResponse(res, "File size must be less than 5 MB", err);
    }
    if (err.message === "UNSUPPORTED_FILE_TYPE") {
      return uploadErrorResponse(
        res,
        "Invalid file type. Only PDF, PNG, and JPEG files are allowed.",
        err,
      );
    }

    return uploadErrorResponse(res, "Failed to read uploaded file", err);
  });
}

export async function uploadSummerMessProofToOnedrive(req, res, next) {
  try {
    const paymentProof = req.files?.paymentProof?.[0] ?? null;
    req.uploadedDocuments = {};

    if (!paymentProof) {
      return res.status(400).json({
        message: "Payment proof is required",
      });
    }
    if (!SUMMER_MESS_FOLDER_ID) {
      return res.status(400).json({
        message: "ONEDRIVE_SUMMER_MESS_FOLDER_ID is not configured",
      });
    }

    const uniqueMiddleName = makeUniqueMiddleName(req.user?._id || "student");
    const result = await uploadBufferToFolder(
      paymentProof.buffer,
      paymentProof.mimetype,
      `summer-mess-proof${uniqueMiddleName}${paymentProof.originalname}`,
      SUMMER_MESS_FOLDER_ID,
    );

    req.uploadedDocuments.paymentProof = result;
    return next();
  } catch (error) {
    logger.error("[SummerMess][OneDrive] upload error:", { error: error });
    return res.status(500).json({
      message: "Failed to upload payment proof",
      error: error.message,
    });
  }
}

export async function sendSummerMessDocument(url, res, options = {}) {
  if (!url || !String(url).trim()) {
    return res.status(404).json({ message: "No document URL attached" });
  }

  try {
    await downloadFromOnedrive(String(url).trim(), res, options);
  } catch (error) {
    logger.error("[SummerMess][OneDrive] send document error:", { error: error });
    return res.status(500).json({
      message: "Failed to fetch payment proof",
      error: error.message,
    });
  }
}
