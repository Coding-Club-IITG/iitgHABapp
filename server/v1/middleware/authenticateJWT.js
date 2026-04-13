import jwt from "jsonwebtoken";

import { User } from "../modules/user/userModel.js";
import { Hostel } from "../modules/hostel/hostelModel.js";

import redisClient from "../utils/redisClient.js";
import AppError from "../utils/appError.js";
import { adminJwtSecret } from "../config/default.js";

const extractAndCheckToken = async (req) => {
  let token = req.cookies?.token;

  if (req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) throw new AppError(403, "Invalid token");

  const isBlacklisted = await redisClient.get(`bl_${token}`);
  if (isBlacklisted) throw new AppError(401, "Token has been revoked");

  return token;
};

function auth(Schema, param) {
  return async function (req, res, next) {
    try {
      const token = await extractAndCheckToken(req);
      const found = await Schema.findByAccessToken(token);

      if (!found) return next(new AppError(403, "Not Authenticated"));

      // Attach the param to the request object
      req[param] = found;
      return next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        console.log("[Auth] Token expired error");
        return next(new AppError(401, "Access token expired"));
      }
      // jwt.verify: bad signature, wrong secret, truncated token, etc. — not a server bug.
      if (
        err.name === "JsonWebTokenError" ||
        err.name === "NotBeforeError"
      ) {
        return next(new AppError(401, "Invalid or malformed access token"));
      }
      if (err instanceof AppError) return next(err);

      console.error("[Auth] Error verifying token:", {
        name: err.name,
        message: err.message,
        tokenLength: token?.length,
      });
      return next(new AppError(500, `Authentication error: ${err.message}`));
    }
  };
}

export const authenticateJWT = auth(User, "user");
export const authenticateAdminJWT = auth(Hostel, "hostel");

export const authenticateUserOrAdminJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    let lastError = null;

    // First, try to treat the token as a normal user token
    try {
      const user = await User.findByAccessToken(token);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new AppError(401, "Access token expired"));
      }
      // For non-expiry JWT errors (e.g. invalid signature), fall through to
      // try hostel token verification instead of immediately returning 500.
      lastError = err;
    }

    // If not a valid user token, try to treat it as a hostel (admin) token
    try {
      const hostel = await Hostel.findByAccessToken(token);
      if (hostel) {
        req.hostel = hostel;
        return next();
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new AppError(401, "Access token expired"));
      }
      lastError = err;
    }

    if (lastError) {
      console.error("Error verifying token:", lastError);
    }

    return next(new AppError(403, "Not Authenticated"));
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error("Error verifying token:", err);
    return next(new AppError(500, "Server error during authentication"));
  }
};

export const authenticateHabJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    const decoded = jwt.verify(token, adminJwtSecret);
    if (!decoded?.hab) return next(new AppError(403, "Not Authenticated"));

    req.hab = decoded;
    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error("Error verifying HAB token:", err);
    return next(new AppError(403, "Not Authenticated"));
  }
};

// Dedicated middleware for HABit HQ
// Validates a hostel JWT (same token as hostel frontend)
// and attaches hostel document as `req.managerHostel`
export const authenticateMessManagerJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    const hostel = await Hostel.findByAccessToken(token);
    if (!hostel) return next(new AppError(403, "Not Authenticated as manager"));

    req.managerHostel = hostel;
    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === "TokenExpiredError") {
      return next(new AppError(401, "Access token expired"));
    }
    if (err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
      return next(new AppError(401, "Invalid or malformed access token"));
    }
    console.error("Error verifying Mess Manager token:", err);
    return next(new AppError(500, "Server error during authentication"));
  }
};

export const authenticateHabOrSMCJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    let lastError = null;

    try {
      const decoded = jwt.verify(token, adminJwtSecret);
      if (decoded?.hab) {
        req.hab = decoded;
        return next();
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new AppError(401, "Access token expired"));
      }
      lastError = err;
    }

    try {
      const user = await User.findByAccessToken(token);
      if (user && user.isSMC) {
        req.user = user;
        return next();
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new AppError(401, "Access token expired"));
      }
      lastError = err;
    }

    if (lastError) console.error("Error verifying token:", lastError);
    return next(new AppError(403, "Not Authenticated"));
  } catch (err) {
    return next(err);
  }
};
