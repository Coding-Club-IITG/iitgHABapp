const express = require("express");
const path = require("path");
const {
  createBugReport,
  getBugReports,
  updateBugReportStatus,
  uploadMiddleware,
} = require("./bugReportController");
const { authenticateJWT, authenticateAdminJWT } = require("../../middleware/authenticateJWT");

const router = express.Router();

// Serve uploaded files
router.use(
  "/files",
  express.static(path.join(__dirname, "../../../uploads/bug-reports"))
);

/**
 * @swagger
 * /api/bug-report:
 *   post:
 *     summary: Submit a bug report or suggestion
 *     tags: [Bug Report]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [bug, suggestion]
 *               email:
 *                 type: string
 *               screenshots:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               deviceInfo:
 *                 type: string
 *               frequency:
 *                 type: string
 *                 enum: [always, sometimes, once]
 *     responses:
 *       201:
 *         description: Bug report submitted successfully
 */
router.post("/", uploadMiddleware, createBugReport);

/**
 * @swagger
 * /api/bug-report:
 *   get:
 *     summary: Get all bug reports and suggestions (Admin only)
 *     tags: [Bug Report]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bug reports and suggestions
 */
router.get("/", authenticateAdminJWT, getBugReports);

/**
 * @swagger
 * /api/bug-report/:id/status:
 *   patch:
 *     summary: Update bug report status (Admin only)
 *     tags: [Bug Report]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bug report status updated
 */
router.patch("/:id/status", authenticateAdminJWT, updateBugReportStatus);

module.exports = router;

