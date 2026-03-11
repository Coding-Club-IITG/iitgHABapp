const axios = require("axios");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET_KEY = process.env.JWT_SECRET;

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - rollNumber
 *         - email
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the user
 *           example: "64a1b2c3d4e5f6789012345"
 *         name:
 *           type: string
 *           description: Full name of the user
 *           example: "John Doe"
 *         degree:
 *           type: string
 *           description: Academic degree program
 *           example: "B.Tech"
 *         rollNumber:
 *           type: string
 *           description: Unique roll number of the student
 *           example: "210101001"
 *         email:
 *           type: string
 *           format: email
 *           description: Email address of the user
 *           example: "john.doe@iitg.ac.in"
 *         year:
 *           type: number
 *           description: Current academic year
 *           example: 3
 *         hostel:
 *           type: string
 *           description: Reference to hostel ObjectId
 *           example: "64a1b2c3d4e5f6789012346"
 *         curr_subscribed_mess:
 *           type: string
 *           description: Currently subscribed mess (hostel reference)
 *           example: "64a1b2c3d4e5f6789012346"
 *         next_mess:
 *           type: string
 *           description: Next mess subscription (hostel reference)
 *           example: "64a1b2c3d4e5f6789012346"
 *         applied_hostel_string:
 *           type: string
 *           description: Applied hostel information
 *           default: ""
 *           example: "Kameng Hostel"
 *         applied_for_mess_changed:
 *           type: boolean
 *           description: Whether user has applied for mess change
 *           default: false
 *           example: false
 *         got_mess_changed:
 *           type: boolean
 *           description: Whether mess change was approved in the current cycle
 *           default: false
 *           example: false
 *         role:
 *           type: string
 *           enum: ["student", "hab", "welfare_secy", "gen_secy"]
 *           description: User role in the system
 *           default: "student"
 *           example: "student"
 *         complaints:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of complaint ObjectIds
 *           example: ["64a1b2c3d4e5f6789012347", "64a1b2c3d4e5f6789012348"]
 *         phoneNumber:
 *           type: string
 *           description: Contact phone number
 *           example: "+91 9876543210"
 *         roomNumber:
 *           type: string
 *           description: Room number in hostel
 *           example: "A-101"
 *         isSMC:
 *           type: boolean
 *           description: Whether the user is a part of the SMC (Student Mess Committee)
 *           default: false
 *           example: false
 *         isSetupDone:
 *           type: boolean
 *           description: Whether the user completed initial setup (profile picture flow)
 *           default: true
 *           example: true
 *         profilePictureUrl:
 *           type: string
 *           description: Public URL to the user's profile picture
 *           example: "https://..."
 *         profilePictureItemId:
 *           type: string
 *           description: OneDrive item id for the user's profile picture
 *           example: "01ABCDEF1234567!987"
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  degree: {
    type: String,
  },
  rollNumber: {
    type: String,
    required: false, // Made optional for Apple Sign In users
    unique: true,
    sparse: true, // Allow multiple null values
  },
  email: {
    type: String,
    required: false, // Optional - only set when Microsoft OAuth is used or linked
  },
  appleUserIdentifier: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  guestIdentifier: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  year: {
    type: Number,
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    index: true,
  },
  curr_subscribed_mess: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    index: true,
    default: function () {
      return this.hostel;
    },
  },
  next_mess1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
  },
  next_mess2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
  },
  next_mess3: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
  },
  applied_hostel_timestamp: {
    type: Date,
  },
  applied_hostel_string: {
    type: String,
    default: "",
  },
  applied_for_mess_changed: {
    type: Boolean,
    default: false,
  },
  got_mess_changed: {
    type: Boolean,
    default: false,
  },
  complaints: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
    },
  ],
  phoneNumber: {
    type: String,
  },
  roomNumber: {
    type: String,
  },
  isSMC: {
    type: Boolean,
    default: false,
    index: true,
  },
  isSetupDone: {
    type: Boolean,
    default: false,
  },
  profilePictureUrl: {
    type: String,
  },
  profilePictureItemId: {
    type: String,
  },
  isFeedbackSubmitted: {
    type: Boolean,
    default: false,
  },
  hasMicrosoftLinked: {
    type: Boolean,
    default: false,
  },
  authProvider: {
    type: String,
    enum: ["apple", "microsoft", "both", "guest"],
    default: "microsoft", // Default for backward compatibility
  },
});

userSchema.methods.generateJWT = function () {
  var user = this;
  var token = jwt.sign({ user: user._id }, JWT_SECRET_KEY, {
    expiresIn: "24d",
  });
  return token;
};

userSchema.statics.findByJWT = async function (token) {
  try {
    var user = this;
    var decoded = jwt.verify(token, JWT_SECRET_KEY);
    const id = decoded.user;
    const fetchedUser = await user.findOne({ _id: id });
    if (!fetchedUser) return false;
    return fetchedUser;
  } catch (error) {
    return false;
  }
};

const User = mongoose.model("User", userSchema);

const getUserFromToken = async function (access_token) {
  try {
    var config = {
      method: "get",
      url: "https://graph.microsoft.com/v1.0/me",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    };
    const response = await axios.get(config.url, {
      headers: config.headers,
    });
    //console.log(response);

    return response;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const findUserWithEmail = async function (email) {
  const user = await User.findOne({ email: email });
  // console.log("found user with email", user);
  if (!user) return false;
  return user;
};

const findUserWithAppleIdentifier = async function (appleUserIdentifier) {
  const user = await User.findOne({ appleUserIdentifier: appleUserIdentifier });
  if (!user) return false;
  return user;
};

const findUserWithGuestIdentifier = async function (guestIdentifier) {
  const user = await User.findOne({ guestIdentifier: guestIdentifier });
  if (!user) return false;
  return user;
};

module.exports = {
  getUserFromToken,
  User,
  findUserWithEmail,
  findUserWithAppleIdentifier,
  findUserWithGuestIdentifier,
};
