const express = require("express");
const {
  authenticateJWT,
  authenticateHabJWT,
  authenticateUserOrAdminJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT.js");

const {
  getUserData,
  saveUserProfile,
  getAllUsers,
  getUserCount,
  deleteUserAccount,
  getUserForManager,
} = require("./userController.js");

const userRouter = express.Router();

userRouter.get("/", authenticateUserOrAdminJWT, getUserData);

userRouter.post("/save", authenticateJWT, saveUserProfile);

userRouter.get("/count", getUserCount);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: "Delete user account"
 *     tags: ["User"]
 *     description: "Deletes the authenticated user's account. Anonymizes historical data and removes user completely."
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Account deleted successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Account deleted successfully"
 *                 note:
 *                   type: string
 *                   example: "Your account has been deleted. Historical data has been anonymized for institutional records."
 *       400:
 *         description: "Cannot delete account (pending mess change)"
 *       403:
 *         description: "Cannot delete account (SMC member)"
 *       500:
 *         description: "Server error"
 */
userRouter.delete("/account", authenticateJWT, deleteUserAccount);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: "Get all users"
 *     tags: ["User"]
 *     description: "Retrieves a list of all users with their subscribed mess names"
 *     responses:
 *       200:
 *         description: "Successfully retrieved all users"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/User'
 *                   - type: object
 *                     properties:
 *                       curr_subscribed_mess_name:
 *                         type: string
 *                         description: "Name of the currently subscribed mess/hostel"
 *                         example: "Kameng Hostel"
 *                         nullable: true
 *             example:
 *               - _id: "64a1b2c3d4e5f6789012345"
 *                 name: "John Doe"
 *                 rollNumber: "210101001"
 *                 email: "john.doe@iitg.ac.in"
 *                 degree: "B.Tech"
 *                 year: 3
 *                 curr_subscribed_mess: "64a1b2c3d4e5f6789012346"
 *                 curr_subscribed_mess_name: "Kameng Hostel"
 *                 role: "student"
 *                 complaints: []
 *                 feedbackSubmitted: false
 *               - _id: "64a1b2c3d4e5f6789012348"
 *                 name: "Jane Smith"
 *                 rollNumber: "210101002"
 *                 email: "jane.smith@iitg.ac.in"
 *                 degree: "M.Tech"
 *                 year: 1
 *                 curr_subscribed_mess: null
 *                 curr_subscribed_mess_name: null
 *                 role: "student"
 *                 complaints: []
 *                 feedbackSubmitted: false
 *       500:
 *         description: "Server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error fetching users"
 */
userRouter.get("/all/hab", authenticateHabJWT, getAllUsers);

// Mess-manager (HABit HQ): fetch user profile by ID
userRouter.get(
  "/manager/:userId",
  authenticateMessManagerJWT,
  getUserForManager,
);

module.exports = userRouter;
