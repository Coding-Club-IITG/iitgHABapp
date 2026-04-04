// server/modules/auth/authController.js
const axios = require("axios");
const qs = require("querystring");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const AppError = require("../../utils/appError.js");
const {
  getUserFromToken,
  User,
  findUserWithEmail,
  findUserWithAppleIdentifier,
  findUserWithGuestIdentifier,
} = require("../user/userModel.js");
const { Hostel } = require("../hostel/hostelModel.js");
const UserAllocHostel = require("../hostel/hostelAllocModel.js");
const {
  sendNotificationToUser,
} = require("../notification/notificationController.js");
require("dotenv").config();
const redisClient = require("../../utils/redisClient.js");

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

// Helper — find hostel allocation by roll no
const getHostelAlloc = async (rollno) => {
  try {
    const allocation = await UserAllocHostel.findOne({ rollno }).populate(
      "hostel",
    );
    return allocation?.hostel || null;
  } catch (err) {
    console.error("Error fetching hostel allocation:", err);
    return null;
  }
};

const getCurrentSubscribedMess = async (rollno) => {
  try {
    const allocation = await UserAllocHostel.findOne({ rollno }).populate(
      "current_subscribed_mess",
    );
    return allocation?.current_subscribed_mess || null;
  } catch (err) {
    console.error("Error fetching current subscribed mess:", err);
    return null;
  }
};

// Mobile redirect (used by app deep link)
const mobileRedirectHandler = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) throw new AppError(400, "Authorization code is missing");

    // If state is "link", this is for account linking - just pass code through
    if (state === "link") {
      return res.redirect(`iitghab://link?code=${code}`);
    }

    const data = qs.stringify({
      client_secret: clientSecret,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "offline_access User.Read", // Must match frontend authorization request
      grant_type: "authorization_code",
      code: code,
    });

    const tokenResp = await axios.post(
      `https://login.microsoftonline.com/850aa78d-94e1-4bc6-9cf3-8c11b530701c/oauth2/v2.0/token`,
      data,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const accessToken = tokenResp.data.access_token;
    const userFromToken = await getUserFromToken(accessToken);
    if (!userFromToken?.data) throw new AppError(401, "Access denied");

    const roll = userFromToken.data.surname;
    if (!roll) throw new AppError(401, "Sign in using Institute Account");

    const allocatedHostel = await getHostelAlloc(roll);
    if (!allocatedHostel)
      throw new AppError(
        401,
        "Hostel allocation not found for this roll number",
      );

    const currentSubscribedMess = await getCurrentSubscribedMess(roll);
    // currentSubscribedMess is optional - if not found, User model will default to hostel

    let existingUser = await findUserWithEmail(userFromToken.data.mail);
    let isFirstLogin = false;

    if (!existingUser) {
      const userData = {
        name: userFromToken.data.displayName,
        degree: userFromToken.data.jobTitle,
        rollNumber: roll,
        email: userFromToken.data.mail, // Email and microsoftEmail are the same
        hostel: allocatedHostel._id,
        authProvider: "microsoft",
        hasMicrosoftLinked: true, // Microsoft login = student account (surname exists)
      };

      // Only set curr_subscribed_mess if we have it, otherwise User model will default to hostel
      if (currentSubscribedMess) {
        userData.curr_subscribed_mess = currentSubscribedMess._id;
      }

      const user = new User(userData);
      existingUser = await user.save();
      isFirstLogin = true;
    } else {
      // Microsoft login always means student account (surname exists), so always set hasMicrosoftLinked
      existingUser.email = userFromToken.data.mail; // Update email to Microsoft email
      existingUser.rollNumber = roll; // Update roll number
      existingUser.hostel = allocatedHostel._id; // Update hostel
      existingUser.hasMicrosoftLinked = true; // Always true for Microsoft login
      existingUser.authProvider =
        existingUser.authProvider === "apple" ? "both" : "microsoft";

      // Update curr_subscribed_mess if we have it
      if (currentSubscribedMess) {
        existingUser.curr_subscribed_mess = currentSubscribedMess._id;
      }

      await existingUser.save();
    }

    const token = existingUser.generateJWT();

    // Welcome notification is now sent from frontend after FCM token registration
    // This ensures the FCM token exists before sending the notification

    return res.redirect(
      `iitghab://success?token=${token}&user=${encodeURIComponent(
        existingUser.email,
      )}`,
    );
  } catch (error) {
    console.error("Error in mobileRedirectHandler:", error);
    next(error);
  }
};

// Logout
const logoutHandler = async (req, res) => {
  const token =
    req.cookies?.token ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  if (token)
    await redisClient.set(`bl_${token}`, "true", "EX", 24 * 24 * 60 * 60);
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out" });
};

// Unified web login handler — HAB / Hostel / SMC
const webLoginHandler = async (req, res, next) => {
  try {
    const { code, type, state } = req.query;
    if (!code) throw new AppError(400, "Authorization code missing");

    const loginType = type || state;
    if (!["hab", "hostel", "smc"].includes(loginType))
      throw new AppError(400, "Invalid login type");

    const webRedirectUri = process.env.WEB_REDIRECT_URI || redirectUri;

    const data = qs.stringify({
      client_secret: clientSecret,
      client_id: clientId,
      redirect_uri: webRedirectUri,
      scope: "user.read",
      grant_type: "authorization_code",
      code,
    });

    const tokenResp = await axios.post(
      `https://login.microsoftonline.com/850aa78d-94e1-4bc6-9cf3-8c11b530701c/oauth2/v2.0/token`,
      data,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const accessToken = tokenResp.data.access_token;
    const userFromToken = await getUserFromToken(accessToken);
    const email = userFromToken?.data?.mail;
    if (!email) throw new AppError(401, "Invalid Microsoft login");

    let token;
    let redirectPath = "/";
    let baseUrl;

    if (loginType === "hab") {
      const HAB_EMAIL = process.env.HAB_EMAIL;
      const HAB_EMAIL2 = process.env.HAB_EMAIL2;
      if (
        email.toLowerCase() !== HAB_EMAIL.toLowerCase() &&
        email.toLowerCase() !== HAB_EMAIL2?.toLowerCase()
      )
        throw new AppError(403, "Unauthorized HAB login");
      token = jwt.sign({ hab: true, email }, process.env.ADMIN_JWT_SECRET, {
        expiresIn: "2h",
      });
      baseUrl = process.env.HAB_FRONTEND_URL;
    }

    if (loginType === "hostel") {
      const { Hostel } = require("../hostel/hostelModel.js");
      const hostel = await Hostel.findOne({ microsoft_email: email });
      if (!hostel) throw new AppError(403, "No hostel found for this email");
      token = hostel.generateJWT();
      baseUrl = process.env.HOSTEL_FRONTEND_URL;
    }

    if (loginType === "smc") {
      console.log("SMC login attempt for email:", email);
      const { Hostel } = require("../hostel/hostelModel.js");
      const secretaryHostel = await Hostel.findOne({
        secretary_email: email.toLowerCase(),
      });

      if (secretaryHostel) {
        token = secretaryHostel.generateJWT();
      } else {
        const existingUser = await findUserWithEmail(email);
        if (!existingUser || !existingUser.isSMC)
          throw new AppError(403, "Unauthorized SMC login");
        token = existingUser.generateJWT();
      }
      baseUrl = process.env.SMC_FRONTEND_URL;
    }
    return res.redirect(
      `${baseUrl}${redirectPath}?token=${encodeURIComponent(token)}`,
    );
  } catch (err) {
    console.error("Error in webLoginHandler:", err);
    next(new AppError(500, "Login failed"));
  }
};

// Validate token from Authorization header
const meHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ authenticated: false });
    }

    const token = authHeader.split(" ")[1];

    // Try user
    try {
      const user = await User.findByJWT(token);
      if (user)
        return res
          .status(200)
          .json({ authenticated: true, type: "user", user });
    } catch {}

    // Try hostel
    try {
      const { Hostel } = require("../hostel/hostelModel.js");
      const hostel = await Hostel.findByJWT(token);
      if (hostel)
        return res
          .status(200)
          .json({ authenticated: true, type: "hostel", hostel });
    } catch {}

    // Try HAB admin
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      if (decoded?.hab)
        return res
          .status(200)
          .json({ authenticated: true, type: "hab", email: decoded.email });
    } catch {}

    return res.status(401).json({ authenticated: false });
  } catch (err) {
    console.error("Error in meHandler:", err);
    return next(new AppError(500, "Error validating token"));
  }
};

// Apple Sign In handler
const appleLoginHandler = async (req, res, next) => {
  try {
    const { identityToken, authorizationCode, userIdentifier, email, name } =
      req.body;

    if (!userIdentifier) {
      throw new AppError(400, "User identifier is required");
    }

    // Note: In production, you should verify the Apple identityToken server-side
    // For now, we'll trust the client-provided userIdentifier (you should add proper verification)

    // Check if user exists by Apple userIdentifier
    let existingUser = await findUserWithAppleIdentifier(userIdentifier);

    if (!existingUser) {
      // Create new user with Apple name and email
      // Store Apple email - it will be replaced with Microsoft email when account is linked
      const userData = {
        name: name || "User",
        email: email || null, // Store Apple email if provided (will be replaced by Microsoft email when linked)
        appleUserIdentifier: userIdentifier,
        // Don't set rollNumber - leave it undefined to avoid MongoDB unique index issues with null
        authProvider: "apple",
        hasMicrosoftLinked: false,
      };
      const user = new User(userData);
      existingUser = await user.save();
    } else {
      // If user exists, update name and email if provided and not already linked to Microsoft
      // Once Microsoft is linked, don't overwrite with Apple data
      if (!existingUser.hasMicrosoftLinked) {
        if (name && name.trim() !== "") {
          existingUser.name = name;
        }
        if (email && email.trim() !== "") {
          existingUser.email = email;
        }
      } else {
        // If Microsoft is already linked, only update name if it's not already set from Microsoft
        if (name && name.trim() !== "" && !existingUser.name) {
          existingUser.name = name;
        }
      }
      await existingUser.save();
    }

    const token = existingUser.generateJWT();
    return res.status(200).json({
      token,
      hasMicrosoftLinked: existingUser.hasMicrosoftLinked || false,
    });
  } catch (err) {
    console.error("Error in appleLoginHandler:", err);
    next(new AppError(500, "Apple login failed"));
  }
};

// Note: linkMicrosoftRedirectHandler removed - using mobileRedirectHandler with state="link" instead

// Microsoft account linking handler
const linkMicrosoftAccount = async (req, res, next) => {
  try {
    const { code } = req.query; // Microsoft OAuth code
    const userId = req.user._id; // From authenticateJWT

    if (!code) {
      throw new AppError(400, "Authorization code is required");
    }

    const data = qs.stringify({
      client_secret: clientSecret,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "offline_access User.Read", // Must match frontend authorization request
      grant_type: "authorization_code",
      code: code,
    });

    const tokenResp = await axios.post(
      `https://login.microsoftonline.com/850aa78d-94e1-4bc6-9cf3-8c11b530701c/oauth2/v2.0/token`,
      data,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const accessToken = tokenResp.data.access_token;
    const userFromToken = await getUserFromToken(accessToken);
    if (!userFromToken?.data) {
      throw new AppError(401, "Invalid Microsoft account");
    }

    const roll = userFromToken.data.surname;
    if (!roll) {
      throw new AppError(
        400,
        "Invalid Microsoft account - roll number not found",
      );
    }

    const microsoftEmail = userFromToken.data.mail;

    // Get the current user trying to link
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new AppError(404, "User not found");
    }

    // Check if a user with this Microsoft email already exists
    const existingUserWithEmail = await findUserWithEmail(microsoftEmail);

    // If email exists and it's a different user, merge accounts
    if (
      existingUserWithEmail &&
      existingUserWithEmail._id.toString() !== userId.toString()
    ) {
      // The Microsoft account already exists - merge Apple/Guest account into Microsoft account
      // Preserve shared fields (profile picture, phone number, room number) from Apple/Guest account
      const appleUserIdentifier = currentUser.appleUserIdentifier;
      const guestIdentifier = currentUser.guestIdentifier;

      // Preserve profile picture from Apple/Guest account if Microsoft account doesn't have one
      if (
        currentUser.profilePictureUrl &&
        !existingUserWithEmail.profilePictureUrl
      ) {
        existingUserWithEmail.profilePictureUrl = currentUser.profilePictureUrl;
      }
      if (
        currentUser.profilePictureItemId &&
        !existingUserWithEmail.profilePictureItemId
      ) {
        existingUserWithEmail.profilePictureItemId =
          currentUser.profilePictureItemId;
      }

      // Preserve phone number from Apple/Guest account if Microsoft account doesn't have one
      if (currentUser.phoneNumber && !existingUserWithEmail.phoneNumber) {
        existingUserWithEmail.phoneNumber = currentUser.phoneNumber;
      }

      // Preserve room number from Apple/Guest account if Microsoft account doesn't have one
      if (currentUser.roomNumber && !existingUserWithEmail.roomNumber) {
        existingUserWithEmail.roomNumber = currentUser.roomNumber;
      }

      // Don't overwrite isSetupDone - persist Microsoft account's state
      // Microsoft account's isSetupDone is already set correctly, don't change it

      // Delete the duplicate Apple/Guest-only user
      await User.findByIdAndDelete(userId);

      // Then update the existing Microsoft user to include Apple identifier (if it was Apple)
      if (appleUserIdentifier) {
        existingUserWithEmail.appleUserIdentifier = appleUserIdentifier;
        existingUserWithEmail.authProvider = "both";
      } else {
        // If it was a guest account, just keep Microsoft account as is
        // guestIdentifier is not preserved (guest accounts are temporary)
      }
      // Keep Microsoft account's data (email, rollNumber, hostel, isSetupDone, etc.)
      await existingUserWithEmail.save();

      // Return token for the merged account
      const token = existingUserWithEmail.generateJWT();
      return res.status(200).json({
        message: "Microsoft account linked successfully - accounts merged",
        token, // Return new token for merged account
        hasMicrosoftLinked: true,
      });
    }

    // Check if roll number already exists (shouldn't happen if email check passed, but double-check)
    const existingUserWithRoll = await User.findOne({ rollNumber: roll });
    if (
      existingUserWithRoll &&
      existingUserWithRoll._id.toString() !== userId.toString()
    ) {
      throw new AppError(
        400,
        "This roll number is already linked to another account",
      );
    }

    // Get hostel allocation
    const allocatedHostel = await getHostelAlloc(roll);
    if (!allocatedHostel) {
      throw new AppError(
        400,
        "Hostel allocation not found for this roll number",
      );
    }

    // Get current subscribed mess if available, otherwise will default to hostel
    const currentSubscribedMess = await getCurrentSubscribedMess(roll);

    // Update current user with Microsoft info
    currentUser.name = userFromToken.data.displayName || currentUser.name; // Update name from Microsoft account
    currentUser.degree = userFromToken.data.jobTitle || currentUser.degree; // Update degree from Microsoft account
    currentUser.email = microsoftEmail;
    currentUser.rollNumber = roll;
    currentUser.hostel = allocatedHostel._id;
    // Use current_subscribed_mess from allocation if available, otherwise default to hostel
    currentUser.curr_subscribed_mess = currentSubscribedMess
      ? currentSubscribedMess._id
      : allocatedHostel._id;
    currentUser.hasMicrosoftLinked = true; // Microsoft account = student account (surname exists)

    // Update authProvider based on current provider
    if (currentUser.authProvider === "apple") {
      currentUser.authProvider = "both";
    } else if (currentUser.authProvider === "guest") {
      // Guest account converted to Microsoft account
      // Keep guestIdentifier for history, but mark as Microsoft account
      currentUser.authProvider = "microsoft";
      // Set isSetupDone to false when guest links Microsoft account (fresh start with student account)
      currentUser.isSetupDone = false;
    } else {
      currentUser.authProvider = "microsoft";
    }

    await currentUser.save();

    return res.status(200).json({
      message: "Microsoft account linked successfully",
      hasMicrosoftLinked: true,
    });
  } catch (err) {
    console.error("Error in linkMicrosoftAccount:", err);
    next(new AppError(500, "Failed to link Microsoft account"));
  }
};

// Guest login
// Backward compatible: Accepts email/password from old app versions but ignores them
// New app versions can send empty body and still login as guest
// Each guest login creates a unique guest account identified by guestIdentifier (UUID)
const guestLoginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    // Backward compatibility: Old app versions send email/password, but we ignore them
    // New app versions send nothing, which is also fine

    // Generate unique guest identifier (UUID) for this guest session
    const guestIdentifier = crypto.randomUUID();

    // Create new guest user for each login (don't reuse accounts)
    // Similar to Apple Sign-In: each guest gets unique account identified by guestIdentifier
    // Give guest users a unique rollNumber to avoid MongoDB sparse unique index conflicts with null
    // Format: "GUEST-{UUID}" - this ensures uniqueness and identifies guest users
    const userData = {
      name: "Guest User",
      guestIdentifier: guestIdentifier,
      rollNumber: `GUEST-${guestIdentifier}`, // Unique rollNumber for guest users to avoid index conflicts
      // Don't set email - leave it undefined (similar to Apple Sign-In when email not provided)
      // Don't set hostel or curr_subscribed_mess
      // This ensures guest users cannot access features requiring these fields
      authProvider: "guest",
      hasMicrosoftLinked: false,
    };

    // Create user using Mongoose (normal approach - rollNumber is explicitly set so no conflicts)
    const existingUser = await User.create(userData);

    const token = existingUser.generateJWT();
    return res.status(200).json({
      token,
      hasMicrosoftLinked: false,
    });
  } catch (err) {
    console.error("Error in guestLoginHandler:", err);
    next(new AppError(500, "Guest login failed"));
  }
};

/**
 * HABit HQ: Hostel manager login via password (no Microsoft OAuth).
 * Body: { hostelName, password }
 * Returns: { success, token, message? }
 */
const managerLoginHandler = async (req, res, next) => {
  try {
    const { hostelName, password } = req.body || {};

    if (!hostelName || !password) {
      return res.status(400).json({
        success: false,
        message: "hostelName and password are required",
      });
    }

    const hostel = await Hostel.findOne({
      hostel_name: hostelName,
    }).select("+managerPasswordHash");

    if (!hostel || !hostel.managerPasswordHash) {
      return res.status(401).json({
        success: false,
        message: "Invalid hostel or password",
      });
    }

    const ok = await bcrypt.compare(
      String(password),
      hostel.managerPasswordHash,
    );
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid hostel or password",
      });
    }

    const token = hostel.generateJWT();
    return res.status(200).json({
      success: true,
      token,
    });
  } catch (err) {
    console.error("Error in managerLoginHandler:", err);
    next(new AppError(500, "Manager login failed"));
  }
};

module.exports = {
  mobileRedirectHandler,
  webLoginHandler,
  meHandler,
  logoutHandler,
  guestLoginHandler,
  appleLoginHandler,
  linkMicrosoftAccount,
  managerLoginHandler,
};
