const express = require("express");
const router = express.Router();
const {
  getFestivalModeStatus,
  uploadFestivalImage,
  toggleFestivalMode,
  deleteFestivalImage,
  getFestivalImageContent,
  getAdminFestivalConfig,
  upload,
} = require("./festivalModeController.js");
const { authenticateHabOrSMCJWT } = require("../../middleware/authenticateJWT.js");
const { getDelegatedAccessToken } = require("../../utils/delegatedGraphAuth.js");

/**
 * @swagger
 * /api/festival-mode/status:
 *   get:
 *     summary: "Get current festival mode status (PUBLIC)"
 *     tags: ["Festival Mode"]
 *     responses:
 *       200:
 *         description: "Festival mode status with image URLs"
 */
router.get("/status", getFestivalModeStatus);

/**
 * @swagger
 * /api/festival-mode/admin/config:
 *   get:
 *     summary: "Get detailed festival config for admin (ADMIN ONLY)"
 *     tags: ["Festival Mode"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Detailed festival mode configuration"
 */
router.get("/admin/config", authenticateHabOrSMCJWT, getAdminFestivalConfig);

/**
 * @swagger
 * /api/festival-mode/upload:
 *   post:
 *     summary: "Upload festival image (ADMIN ONLY)"
 *     tags: ["Festival Mode"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               imageType:
 *                 type: string
 *                 enum: ["with_alerts", "without_alerts"]
 *               overlayText:
 *                 type: string
 *                 description: "Text to display on image overlay (default: Happy Diwali)"
 *               file:
 *                 type: string
 *                 format: binary
 */
router.post(
  "/upload",
  authenticateHabOrSMCJWT,
  upload.single("file"),
  uploadFestivalImage
);

/**
 * @swagger
 * /api/festival-mode/toggle:
 *   post:
 *     summary: "Enable/disable festival mode (ADMIN ONLY)"
 *     tags: ["Festival Mode"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 */
router.post("/toggle", authenticateHabOrSMCJWT, toggleFestivalMode);

router.get("/image/item/:itemId", getFestivalImageContent);

/**
 * @swagger
 * /api/festival-mode/image/{imageType}:
 *   delete:
 *     summary: "Delete festival image (ADMIN ONLY)"
 *     tags: ["Festival Mode"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: imageType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: ["with_alerts", "without_alerts"]
 */
router.delete("/image/:imageType", authenticateHabOrSMCJWT, deleteFestivalImage);

// Diagnostic endpoint for OneDrive token status (ADMIN DEBUG ONLY)
router.get("/admin/diagnostics/onedrive-token", authenticateHabOrSMCJWT, async (req, res, next) => {
  try {
    console.log(`[Festival Diagnostics] Checking OneDrive token status...`);
    const token = await getDelegatedAccessToken();
    
    if (token) {
      // Try to decode JWT to see expiration
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          return res.status(200).json({
            status: "OK",
            message: "OneDrive token is valid",
            tokenExpires: new Date(payload.exp * 1000).toISOString(),
            scopes: payload.scp,
          });
        } catch (e) {
          return res.status(200).json({
            status: "OK",
            message: "OneDrive token is valid (could not decode details)",
          });
        }
      }
    }
  } catch (err) {
    console.error(`[Festival Diagnostics] Token check failed:`, err.message);
    return res.status(400).json({
      status: "ERROR",
      message: err.message || "Failed to retrieve OneDrive token",
      details: err.message
    });
  }
});

module.exports = router;
