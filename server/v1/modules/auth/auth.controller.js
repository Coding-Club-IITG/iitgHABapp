import { logger } from "../../logging/logger.js";
import axios from "axios";
import qs from "querystring";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";

import {
  getUserFromToken,
  User,
  findUserWithEmail,
  findUserWithAppleIdentifier,
  isTokenVersionCurrent,
} from "../user/userModel.js";
import { Hostel } from "../hostel/hostelModel.js";
import UserAllocHostel from "../hostel/hostelAllocModel.js";
import Session from "../session/session.model.js";
import { SummerMessApplication } from "../summer_mess/summerMessApplicationModel.js";
import { SummerMessSettings } from "../summer_mess/summerMessSettingsModel.js";

import AppError from "../../utils/appError.js";
import redisClient from "../../utils/redisClient.js";
import {
  refreshSecret,
  adminJwtSecret,
  webRedirectUri,
  habEmail,
  habEmail2,
  debugMail,
  habFrontendUrl,
  hostelFrontendUrl,
  smcFrontendUrl,
} from "../../config/default.js";
import onedrive from "../../config/onedrive.js";

// Helper - find hostel allocation by roll no
const getHostelAlloc = async (rollno) => {
  try {
    const allocation = await UserAllocHostel.findOne({ rollno }).populate(
      "hostel",
    );
    return allocation?.hostel || null;
  } catch (err) {
    logger.error("Error fetching hostel allocation:", { error: err });
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
    logger.error("Error fetching current subscribed mess:", { error: err });
    return null;
  }
};

const resolveSubscribedMessForRoll = async ({ rollno, fallbackHostelId }) => {
  try {
    const activeSummerSeason = await SummerMessSettings.findOne({
      isSummerActive: true,
    })
      .select("seasonKey")
      .lean();

    if (!activeSummerSeason) {
      const currentSubscribedMess = await getCurrentSubscribedMess(rollno);
      return (
        currentSubscribedMess?._id ||
        currentSubscribedMess ||
        fallbackHostelId ||
        null
      );
    }

    const user = await User.findOne({ rollNumber: rollno })
      .select("_id")
      .lean();
    if (!user) return null;

    const acknowledgedApplication = await SummerMessApplication.findOne({
      user: user._id,
      seasonKey: activeSummerSeason.seasonKey,
      status: "Acknowledged",
    })
      .select("appliedHostel")
      .lean();

    return acknowledgedApplication?.appliedHostel || null;
  } catch (err) {
    logger.error("Error resolving summer-aware subscribed mess:", { error: err });
    return null;
  }
};

const syncUserAllocationMess = async ({
  rollno,
  hostelId,
  currentSubscribedMessId,
  email,
}) => {
  if (!rollno || !hostelId) return;

  const update = {
    hostel: hostelId,
    current_subscribed_mess: currentSubscribedMessId || hostelId,
  };

  if (email) {
    update.email = email;
  }

  await UserAllocHostel.findOneAndUpdate(
    { rollno },
    { $set: update },
    { upsert: true, new: true, runValidators: true },
  );
};

// Mobile redirect (used by app deep link)
export const mobileRedirectHandler = async (req, res, next) => {
  const rid =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    req.headers["x-amzn-trace-id"] ||
    "no-rid";
  try {
    const { code, state } = req.query;
    logger.info("[Auth][MobileRedirect][start]", {
      rid,
      hasCode: Boolean(code),
      state: state ? String(state) : undefined,
      redirectUriHost: (() => {
        try {
          return new URL(onedrive.redirectUri).host;
        } catch {
          return "invalid";
        }
      })(),
    });
    if (!code) throw new AppError(400, "Authorization code is missing");

    // If state is "link", this is for account linking - just pass code through
    if (state === "link") {
      logger.info("[Auth][MobileRedirect][link-state]", { rid });
      return res.redirect(`iitghab://link?code=${code}`);
    }

    logger.info("[Auth][MobileRedirect][token-exchange][request]", { rid });
    const data = qs.stringify({
      client_secret: onedrive.clientSecret,
      client_id: onedrive.clientId,
      redirect_uri: onedrive.redirectUri,
      scope: "offline_access User.Read", // Must match frontend authorization request
      grant_type: "authorization_code",
      code: code,
    });

    const tokenResp = await axios.post(
      `https://login.microsoftonline.com/850aa78d-94e1-4bc6-9cf3-8c11b530701c/oauth2/v2.0/token`,
      data,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    logger.info("[Auth][MobileRedirect][token-exchange][ok]", {
      rid,
      hasAccessToken: Boolean(tokenResp?.data?.access_token),
      expiresIn: tokenResp?.data?.expires_in,
    });

    const microsoftAccessToken = tokenResp.data.access_token;
    logger.info("[Auth][MobileRedirect][graph-me][request]", { rid });
    const userFromToken = await getUserFromToken(microsoftAccessToken);
    if (!userFromToken?.data) throw new AppError(401, "Access denied");
    logger.info("[Auth][MobileRedirect][graph-me][ok]", {
      rid,
      hasMail: Boolean(userFromToken?.data?.mail),
      hasSurname: Boolean(userFromToken?.data?.surname),
      tenant: userFromToken?.data?.tenantId,
    });

    let roll = userFromToken.data.surname;
    let allocatedHostel = null;
    let currentSubscribedMess = null;

    if (roll) {
      logger.info("[Auth][MobileRedirect][hostel-alloc][request]", {
        rid,
        roll,
      });
      allocatedHostel = await getHostelAlloc(roll);
      currentSubscribedMess = await getCurrentSubscribedMess(roll);
    } else {
      const email = userFromToken.data.mail;
      logger.info("[Auth][MobileRedirect][hostel-alloc][request-by-email]", {
        rid,
        email,
      });
      if (email) {
        const allocation = await UserAllocHostel.findOne({ email })
          .populate("hostel")
          .populate("current_subscribed_mess");
        if (allocation) {
          roll = allocation.rollno;
          allocatedHostel = allocation.hostel;
          currentSubscribedMess = allocation.current_subscribed_mess || null;
        }
      }
    }

    if (!roll) throw new AppError(401, "Sign in using Institute Account");

    if (!allocatedHostel)
      throw new AppError(
        401,
        "Hostel allocation not found for this roll number or email",
      );

    logger.info("[Auth][MobileRedirect][hostel-alloc][ok]", {
      rid,
      roll,
      hostelId: String(allocatedHostel?._id),
    });
    currentSubscribedMess = await resolveSubscribedMessForRoll({
      rollno: roll,
      fallbackHostelId: allocatedHostel._id,
    });

    // During active summer, this resolves to null unless the student has an acknowledged summer application.

    let existingUser = await findUserWithEmail(userFromToken.data.mail);
    let isFirstLogin = false;
    logger.info("[Auth][MobileRedirect][user-lookup]", {
      rid,
      roll,
      email: userFromToken?.data?.mail,
      found: Boolean(existingUser),
    });

    if (!existingUser) {
      logger.info("[Auth][MobileRedirect][user-create][start]", {
        rid,
        roll,
        email: userFromToken?.data?.mail,
      });
      const userData = {
        name: userFromToken.data.displayName,
        degree: userFromToken.data.jobTitle,
        rollNumber: roll,
        email: userFromToken.data.mail, // Email and microsoftEmail are the same
        hostel: allocatedHostel._id,
        authProvider: "microsoft",
        hasMicrosoftLinked: true, // Microsoft login = student account (surname exists)
      };

      userData.curr_subscribed_mess = currentSubscribedMess;

      const user = new User(userData);
      existingUser = await user.save();
      await syncUserAllocationMess({
        rollno: roll,
        hostelId: allocatedHostel._id,
        currentSubscribedMessId: currentSubscribedMess,
        email: userFromToken.data.mail,
      });
      isFirstLogin = true;
      logger.info("[Auth][MobileRedirect][user-create][ok]", {
        rid,
        userId: String(existingUser?._id),
        isFirstLogin,
      });
    } else {
      logger.info("[Auth][MobileRedirect][user-update][start]", {
        rid,
        userId: String(existingUser?._id),
        roll,
      });
      // Microsoft login always means student account (surname exists), so always set hasMicrosoftLinked
      existingUser.email = userFromToken.data.mail; // Update email to Microsoft email
      existingUser.rollNumber = roll; // Update roll number
      existingUser.hostel = allocatedHostel._id; // Update hostel
      existingUser.hasMicrosoftLinked = true; // Always true for Microsoft login
      existingUser.authProvider =
        existingUser.authProvider === "apple" ? "both" : "microsoft";

      existingUser.curr_subscribed_mess = currentSubscribedMess;

      await existingUser.save();
      await syncUserAllocationMess({
        rollno: roll,
        hostelId: allocatedHostel._id,
        currentSubscribedMessId: currentSubscribedMess,
        email: userFromToken.data.mail,
      });
      logger.info("[Auth][MobileRedirect][user-update][ok]", {
        rid,
        userId: String(existingUser?._id),
      });
    }

    if (existingUser.isBanned) {
      throw new AppError(403, "Your account has been banned");
    }

    const accessToken = existingUser.generateAccessToken();
    const refreshToken = existingUser.generateRefreshToken();
    logger.info("[Auth][MobileRedirect][jwt][ok]", {
      rid,
      userId: String(existingUser?._id),
    });

    await Session.create({
      user: existingUser._id,
      refreshToken: refreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    logger.info("[Auth][MobileRedirect][session][created]", {
      rid,
      userId: String(existingUser?._id),
    });

    // Welcome notification is now sent from frontend after FCM token registration
    // This ensures the FCM token exists before sending the notification

    const redirectUrl = `iitghab://success?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${encodeURIComponent(
      existingUser.email,
    )}`;
    logger.info("[Auth][MobileRedirect][redirect]", {
      rid,
      userId: String(existingUser?._id),
      isFirstLogin,
    });
    return res.redirect(redirectUrl);
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    logger.error("Error in mobileRedirectHandler:", {
      rid,
      message: error?.message,
      status,
      data: data
        ? {
            error: data.error,
            error_description: data.error_description,
            error_codes: data.error_codes,
            suberror: data.suberror,
            trace_id: data.trace_id,
            correlation_id: data.correlation_id,
            timestamp: data.timestamp,
          }
        : undefined,
    });
    next(error);
  }
};

// Refresh
export const refreshTokenHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.info("Refresh token is missing");

      return res.status(401).json({ message: "Refresh token is missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
      logger.error("Error verifying refresh token:", { error: err });
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await Session.findOne({
      refreshToken: hashedToken,
      isRevoked: false,
    });

    if (!session) {
      logger.error("Session not found");
      return res.status(401).json({ message: "Session not found" });
    }

    if (session.expiresAt < new Date()) {
      logger.error("Session expired");
      return res.status(401).json({ message: "Session expired" });
    }

    const user = await User.findById(decoded.user);
    if (!user) {
      logger.error("User not found");
      return res.status(401).json({ message: "User not found" });
    }

    if (!isTokenVersionCurrent(decoded, user)) {
      session.isRevoked = true;
      await session.save();
      return res.status(401).json({ message: "Session revoked" });
    }

    if (user.isBanned) {
      logger.error("User is banned");
      return res.status(401).json({ message: "User has been banned" });
    }

    const accessToken = user.generateAccessToken();
    session.isRevoked = true;
    await session.save();
    /// TODO: Maybe delete old session to prevent useless DB entries

    const newRefreshToken = user.generateRefreshToken();

    await Session.create({
      user: user._id,
      refreshToken: newRefreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    logger.error("Error in refreshTokenHandler:", { error: err });
    next(new AppError(500, "Failed to refresh token"));
  }
};

// Logout
export const logoutHandler = async (req, res) => {
  const token =
    req.cookies?.token ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  if (token)
    await redisClient.set(`bl_${token}`, "true", "EX", 24 * 24 * 60 * 60);

  const refreshToken = req.body?.refreshToken;
  if (refreshToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    await Session.updateOne(
      { refreshToken: hashedToken, isRevoked: false },
      { $set: { isRevoked: true } },
    );
  }

  res.clearCookie("token");
  res.status(200).json({ message: "Logged out" });
};

// HAB admin: revoke every access and refresh token for one student
export const revokeUserSessionsHandler = async (req, res, next) => {
  try {
    const userId = req.body?.userId?.toString().trim();
    const rollNumber = req.body?.rollNumber?.toString().trim();

    if (!userId && !rollNumber) {
      return res.status(400).json({
        message: "Provide userId or rollNumber",
      });
    }

    const lookup = userId ? { _id: userId } : { rollNumber };
    const user = await User.findOneAndUpdate(
      lookup,
      { $inc: { tokenVersion: 1 } },
      { new: true },
    ).select("_id rollNumber tokenVersion");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const sessions = await Session.updateMany(
      { user: user._id, isRevoked: false },
      { $set: { isRevoked: true } },
    );

    logger.info("[Auth][AdminRevoke]", {
      actor: req.hab?.email,
      userId: String(user._id),
      rollNumber: user.rollNumber,
      tokenVersion: user.tokenVersion,
      revokedRefreshSessions: sessions.modifiedCount,
    });

    return res.status(200).json({
      message: "All user sessions revoked",
      userId: String(user._id),
      rollNumber: user.rollNumber,
      tokenVersion: user.tokenVersion,
      revokedRefreshSessions: sessions.modifiedCount,
    });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid userId" });
    }
    return next(new AppError(500, "Failed to revoke user sessions"));
  }
};

// Unified web login handler - HAB / Hostel / SMC
export const webLoginHandler = async (req, res, next) => {
  try {
    const { code, type, state } = req.query;
    if (!code) throw new AppError(400, "Authorization code missing");

    const loginType = type || state;
    if (!["hab", "hostel", "smc"].includes(loginType))
      throw new AppError(400, "Invalid login type");

    const data = qs.stringify({
      client_secret: onedrive.clientSecret,
      client_id: onedrive.clientId,
      redirect_uri: webRedirectUri || onedrive.redirectUri,
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
      if (
        email.toLowerCase() !== habEmail.toLowerCase() &&
        email.toLowerCase() !== habEmail2?.toLowerCase() &&
        email.toLowerCase() !== debugMail?.toLowerCase()
      )
        throw new AppError(403, "Unauthorized HAB login");
      token = jwt.sign({ hab: true, email }, adminJwtSecret, {
        expiresIn: "2h",
      });
      baseUrl = habFrontendUrl;
    }

    if (loginType === "hostel") {
      const hostel = await Hostel.findOne({ microsoft_email: email });
      if (!hostel) throw new AppError(403, "No hostel found for this email");
      token = hostel.generateJWT();
      baseUrl = hostelFrontendUrl;
    }

    if (loginType === "smc") {
      logger.info("SMC login attempt received");

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
      baseUrl = smcFrontendUrl;
    }
    return res.redirect(
      `${baseUrl}${redirectPath}?token=${encodeURIComponent(token)}`,
    );
  } catch (err) {
    logger.error("Error in webLoginHandler:", { error: err });
    next(new AppError(500, "Login failed"));
  }
};

// Validate token from Authorization header
export const meHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ authenticated: false });
    }

    const token = authHeader.split(" ")[1];

    // Try user
    try {
      const user = await User.findByAccessToken(token);
      if (user)
        return res
          .status(200)
          .json({ authenticated: true, type: "user", user });
    } catch {}

    // Try hostel
    try {
      const hostel = await Hostel.findByAccessToken(token);
      if (hostel)
        return res
          .status(200)
          .json({ authenticated: true, type: "hostel", hostel });
    } catch {}

    // Try HAB admin
    try {
      const decoded = jwt.verify(token, adminJwtSecret);
      if (decoded?.hab)
        return res
          .status(200)
          .json({ authenticated: true, type: "hab", email: decoded.email });
    } catch {}

    return res.status(401).json({ authenticated: false });
  } catch (err) {
    logger.error("Error in meHandler:", { error: err });
    return next(new AppError(500, "Error validating token"));
  }
};

// Apple Sign In handler
export const appleLoginHandler = async (req, res, next) => {
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

    if (existingUser.isBanned) {
      throw new AppError(403, "Your account has been banned");
    }

    const token = existingUser.generateJWT();
    return res.status(200).json({
      token,
      hasMicrosoftLinked: existingUser.hasMicrosoftLinked || false,
    });
  } catch (err) {
    logger.error("Error in appleLoginHandler:", { error: err });
    next(new AppError(500, "Apple login failed"));
  }
};

// Note: linkMicrosoftRedirectHandler removed - using mobileRedirectHandler with state="link" instead

// Microsoft account linking handler
export const linkMicrosoftAccount = async (req, res, next) => {
  try {
    const { code } = req.query; // Microsoft OAuth code
    const userId = req.user._id; // From authenticateJWT

    if (!code) {
      throw new AppError(400, "Authorization code is required");
    }

    const data = qs.stringify({
      client_secret: onedrive.clientSecret,
      client_id: onedrive.clientId,
      redirect_uri: onedrive.redirectUri,
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
      const accessToken = existingUserWithEmail.generateAccessToken();
      const refreshToken = existingUserWithEmail.generateRefreshToken();
      return res.status(200).json({
        message: "Microsoft account linked successfully - accounts merged",
        accessToken, // Return new token for merged account
        refreshToken,
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

    const currentSubscribedMess = await resolveSubscribedMessForRoll({
      rollno: roll,
      fallbackHostelId: allocatedHostel._id,
    });

    // Update current user with Microsoft info
    currentUser.name = userFromToken.data.displayName || currentUser.name; // Update name from Microsoft account
    currentUser.degree = userFromToken.data.jobTitle || currentUser.degree; // Update degree from Microsoft account
    currentUser.email = microsoftEmail;
    currentUser.rollNumber = roll;
    currentUser.hostel = allocatedHostel._id;
    currentUser.curr_subscribed_mess = currentSubscribedMess;
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
    await syncUserAllocationMess({
      rollno: roll,
      hostelId: allocatedHostel._id,
      currentSubscribedMessId: currentSubscribedMess,
      email: microsoftEmail,
    });

    return res.status(200).json({
      message: "Microsoft account linked successfully",
      hasMicrosoftLinked: true,
    });
  } catch (err) {
    logger.error("Error in linkMicrosoftAccount:", { error: err });
    next(new AppError(500, "Failed to link Microsoft account"));
  }
};

// Guest login
// Backward compatible: Accepts email/password from old app versions but ignores them
// New app versions can send empty body and still login as guest
// Each guest login creates a unique guest account identified by guestIdentifier (UUID)
export const guestLoginHandler = async (req, res, next) => {
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

    const access_token = existingUser.generateAccessToken();
    const refresh_token = existingUser.generateRefreshToken();
    return res.status(200).json({
      accessToken: access_token,
      refreshToken: refresh_token,
      hasMicrosoftLinked: false,
    });
  } catch (err) {
    logger.error("Error in guestLoginHandler:", { error: err });
    next(new AppError(500, "Guest login failed"));
  }
};

/**
 * HABit HQ: Hostel manager login via password (no Microsoft OAuth).
 * Body: { hostelName, password }
 * Returns: { success, token, message? }
 */
export const managerLoginHandler = async (req, res, next) => {
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
    logger.error("Error in managerLoginHandler:", { error: err });
    next(new AppError(500, "Manager login failed"));
  }
};
