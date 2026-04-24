import fs from "fs";
import path from "path";
import express from "express";
import multer from "multer";

import {
  authenticateUserOrAdminJWT,
  authenticateHabJWT,
  authenticateAdminJWT,
} from "../../middleware/authenticateJWT.js";

import {
  createHostel,
  getHostel,
  getHostelbyId,
  getAllHostels,
  getAllHostelsWithMess,
  getAllHostelNameAndCaterer,
  getCatererInfo,
  getBoarders,
  getMessSubscribers,
  getMessSubscribersSnapshotMonths,
  getMessSubscribersCountByMonth,
  getMessSubscribersByHostelId,
  markAsSMC,
  unmarkAsSMC,
  getSMCMembers,
  getHMCMembers,
  setHMCMembers,
  setHostelPassword,
} from "./hostelController.js";
import { uploadData, getAllocations, updateAllocation } from "./hostelAlloc.js";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const hostelRouter = express.Router();

hostelRouter.get("/allocations", authenticateHabJWT, getAllocations);
hostelRouter.put("/allocations/:id", authenticateHabJWT, updateAllocation);
/**
 * @swagger
 * /api/hostel:
 *   post:
 *     summary: "Create a new hostel"
 *     tags: ["Hostel"]
 *     description: "Creates a new hostel and assigns it to a mess"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hostel_name
 *               - messId
 *             properties:
 *               hostel_name:
 *                 type: string
 *                 example: "Kameng Hostel"
 *               messId:
 *                 type: string
 *                 example: "64a1b2c3d4e5f6789012347"
 *     responses:
 *       201:
 *         description: "Hostel created successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hostel created successfully"
 *                 hostel:
 *                   $ref: '#/components/schemas/Hostel'
 *       400:
 *         description: "Mess not found"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mess not found"
 *       500:
 *         description: "Server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error occurred"
 */
hostelRouter.post("/", authenticateHabJWT, createHostel);

/**
 * @swagger
 * /api/hostel/all/{hostelId}:
 *   get:
 *     summary: "Get hostel by ID"
 *     tags: ["Hostel"]
 *     description: "Retrieves a specific hostel by its ID with populated mess and user information"
 *     parameters:
 *       - name: hostelId
 *         in: path
 *         required: true
 *         description: "Unique identifier of the hostel"
 *         schema:
 *           type: string
 *           example: "64a1b2c3d4e5f6789012346"
 *     responses:
 *       200:
 *         description: "Hostel found successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hostel found"
 *                 hostel:
 *                   $ref: '#/components/schemas/Hostel'
 *       404:
 *         description: "Hostel not found"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hostel not found"
 *       500:
 *         description: "Server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error occurred"
 */
hostelRouter.get(
  "/all/smc/:hostelId",
  authenticateUserOrAdminJWT,
  getHostelbyId,
);
hostelRouter.get("/all/hab/:hostelId", authenticateHabJWT, getHostelbyId);
hostelRouter.get("/get", authenticateAdminJWT, getHostel);

/**
 * @swagger
 * /api/hostel/all:
 *   get:
 *     summary: "Get all hostels"
 *     tags: ["Hostel"]
 *     description: "Retrieves a list of all hostels in the system"
 *     responses:
 *       200:
 *         description: "Successfully retrieved all hostels"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Hostel'
 *             example:
 *               - _id: "64a1b2c3d4e5f6789012346"
 *                 hostel_name: "Kameng Hostel"
 *                 users: []
 *                 messId: "64a1b2c3d4e5f6789012347"
 *                 curr_cap: 0
 *               - _id: "64a1b2c3d4e5f6789012348"
 *                 hostel_name: "Brahmaputra Hostel"
 *                 users: []
 *                 messId: "64a1b2c3d4e5f6789012349"
 *                 curr_cap: 25
 *       500:
 *         description: "Server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error occurred"
 */
hostelRouter.get("/all", getAllHostels);

hostelRouter.get("/allhostel", authenticateHabJWT, getAllHostelsWithMess);

//Route to get only hostel and caterer information
hostelRouter.post("/gethnc", authenticateHabJWT, getAllHostelNameAndCaterer);

// Allocation upload endpoint
hostelRouter.post(
  "/alloc/upload",
  authenticateHabJWT,
  upload.single("file"),
  uploadData,
);

// Hostel-side routes (requires authentication)
hostelRouter.get("/caterer-info", authenticateAdminJWT, getCatererInfo);
hostelRouter.get("/boarders", authenticateAdminJWT, getBoarders);
hostelRouter.get("/mess-subscribers", authenticateAdminJWT, getMessSubscribers);
hostelRouter.get(
  "/mess-subscribers/snapshot-months",
  authenticateAdminJWT,
  getMessSubscribersSnapshotMonths,
);
hostelRouter.get(
  "/mess-subscribers/count",
  authenticateAdminJWT,
  getMessSubscribersCountByMonth,
);
// HAB endpoint to get mess subscribers for a given hostel ID
hostelRouter.get(
  "/mess-subscribers/:hostelId",
  authenticateHabJWT,
  getMessSubscribersByHostelId,
);
hostelRouter.get("/smc-members", authenticateAdminJWT, getSMCMembers);
hostelRouter.post("/mark-smc", authenticateAdminJWT, markAsSMC);
hostelRouter.post("/unmark-smc", authenticateAdminJWT, unmarkAsSMC);
hostelRouter.get("/hmc-members", authenticateUserOrAdminJWT, getHMCMembers);
hostelRouter.post("/hmc-members", authenticateAdminJWT, setHMCMembers);

// HAB-only: set or update encrypted hostel password
hostelRouter.post("/set-password", authenticateHabJWT, setHostelPassword);
export default hostelRouter;
