const express = require("express");
const router = express.Router();
const {
  getVersionInfo,
  // updateVersionInfo,
  // getAllVersionInfo,
} = require("./appVersionController");

/**
 * @swagger
 * /api/app-version/{platform}:
 *   get:
 *     summary: Get app version info for a platform
 *     tags: [App Version]
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [android, ios]
 *         description: The platform (android or ios)
 *     responses:
 *       200:
 *         description: Version info retrieved successfully
 *       400:
 *         description: Invalid platform
 *       500:
 *         description: Server error
 */
router.get("/:platform", getVersionInfo);

// router.put("/:platform", updateVersionInfo);
// router.get("/", getAllVersionInfo);

module.exports = router;
