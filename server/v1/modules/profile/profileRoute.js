const express = require("express");
const multer = require("multer");
const {
  setProfilePicture,
  getProfilePicture,
  getProfilePictureForManager,
  markSetupComplete,
} = require("./profileController.js");
const {
  getSettings,
  enablePhotoChange,
  disablePhotoChange,
} = require("./profileSettingsController.js");
const {
  authenticateJWT,
  authenticateHabJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT.js");

const router = express.Router();

// Use memory storage, we'll stream to OneDrive
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
}); // 4MB limit for simple upload

// Settings routes
router.get("/settings", getSettings);
router.post(
  "/settings/enable-photo-change",
  authenticateHabJWT,
  enablePhotoChange,
);
router.post(
  "/settings/disable-photo-change",
  authenticateHabJWT,
  disablePhotoChange,
);

/**
 * @swagger
 * /api/profile/picture/set:
 *   post:
 *     summary: Upload user's profile picture
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated
 */
// Profile picture upload with error handling
const uploadMiddleware = (req, res, next) => {
  console.log("[Profile][v1] uploadMiddleware start", {
    method: req.method,
    url: req.originalUrl,
  });

  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        console.error("[Profile][v1] Multer error in uploadMiddleware", {
          code: err.code,
          message: err.message,
        });

        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File too large. Maximum size is 4MB." });
        }
        return res
          .status(400)
          .json({ message: `Multer error: ${err.message}` });
      }

      console.error("[Profile][v1] Non-multer upload error", {
        message: err.message,
        stack: err.stack,
      });
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }

    console.log("[Profile][v1] uploadMiddleware success", {
      hasFile: !!req.file,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
    });
    next();
  });
};

router.post(
  "/picture/set",
  uploadMiddleware,
  authenticateJWT,
  setProfilePicture,
);

/**
 * @swagger
 * /api/profile/picture/get:
 *   get:
 *     summary: Get user's profile picture URL or stream
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Returns URL or image bytes
 */
router.get("/picture/get", authenticateJWT, getProfilePicture);

// Mess-manager (HABit HQ): get profile picture for a user by ID
router.get(
  "/picture/manager/:userId",
  authenticateMessManagerJWT,
  getProfilePictureForManager,
);

/** Mark setup complete */
router.post("/setup/complete", authenticateJWT, markSetupComplete);

module.exports = router;
