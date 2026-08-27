import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { adminJwtSecret } from "../../config/default.js";

/**
 * @swagger
 * components:
 *   schemas:
 *     Hostel:
 *       type: object
 *       required:
 *         - hostel_name
 *         - curr_cap
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the hostel
 *           example: "64a1b2c3d4e5f6789012346"
 *         hostel_name:
 *           type: string
 *           description: Name of the hostel
 *           example: "Kameng Hostel"
 *         messId:
 *           type: string
 *           description: Reference to Mess ObjectId
 *           example: "64a1b2c3d4e5f6789012347"
 *         curr_cap:
 *           type: number
 *           description: Current capacity/number of users in hostel
 *           default: 0
 *           example: 150
 */

const hostelSchema = new mongoose.Schema({
  hostel_name: {
    type: String,
    required: true,
    unique: true,
  },
  messId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mess",
  },
  curr_cap: {
    type: Number,
    required: true,
  },
  microsoft_email: {
    type: String,
    required: true,
    unique: true,
  },
  secretary_email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  // Encrypted (hashed) password for hostel-level logins (e.g. HABit HQ).
  managerPasswordHash: {
    type: String,
    select: false,
  },
  isLaundryAvailable: {
    type: Boolean,
    default: false,
  },
  hmcMembers: [
    {
      type: {
        type: String,
        enum: [
          "General Secretary",
          "Associate General Secretary",
          "Literary Secretary",
          "Cultural Secretary",
          "Technical Secretary",
          "Sports Secretary",
          "Welfare Secretary",
          "Maintenance Secretary",
          "Service Secretary",
        ],
        required: true,
      },
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
  ],
});

hostelSchema.methods.generateJWT = function () {
  let hostel = this;
  let token = jwt.sign({ hostel: hostel._id }, adminJwtSecret, {
    expiresIn: "2h",
  });

  return token;
};

hostelSchema.statics.findByAccessToken = async function (token) {
  try {
    let hostel = this;
    var decoded = jwt.verify(token, adminJwtSecret);
    const id = decoded.hostel;
    const fetchedHostel = await hostel.findOne({ _id: id }).populate("messId");
    if (!fetchedHostel) return false;
    return fetchedHostel;
  } catch (error) {
    logger.error("Error verifying token:", { error: error });
    throw error;
  }
};

export const Hostel = mongoose.model("Hostel", hostelSchema);
