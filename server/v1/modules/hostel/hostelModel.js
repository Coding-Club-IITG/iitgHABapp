//const axios =require("axios");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const { adminjwtsecret } = require("../../config/default.js");

dotenv.config();
// Added comment 32

/**
 * @swagger
 * components:
 *   schemas:
 *     UserTimeStamp:
 *       type: object
 *       required:
 *         - user
 *       properties:
 *         user:
 *           type: string
 *           description: Reference to User ObjectId
 *           example: "64a1b2c3d4e5f6789012345"
 *         reason_for_change:
 *           type: string
 *           description: Reason for hostel change
 *           default: ""
 *           example: "Academic requirements"
 *
 *     Hostel:
 *       type: object
 *       required:
 *         - hostel_name
 *         - users
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
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserTimeStamp'
 *           description: Array of users in this hostel
 *           default: []
 *           example: [
 *             {
 *               "user": "64a1b2c3d4e5f6789012345",
 *               "reason_for_change": "Academic requirements"
 *             }
 *           ]
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
});

hostelSchema.methods.generateJWT = function () {
  let hostel = this;
  //console.log("jwtsec", adminjwtsecret);
  let token = jwt.sign({ hostel: hostel._id }, adminjwtsecret, {
    expiresIn: "2h",
  });

  return token;
};

hostelSchema.statics.findByJWT = async function (token) {
  try {
    let hostel = this;
    var decoded = jwt.verify(token, adminjwtsecret);
    const id = decoded.hostel;
    const fetchedHostel = await hostel.findOne({ _id: id }).populate("messId");
    if (!fetchedHostel) return false;
    return fetchedHostel;
  } catch (error) {
    console.error("Error verifying token:", error);
    return false;
  }
};

const Hostel = mongoose.model("Hostel", hostelSchema);

module.exports = { Hostel };
