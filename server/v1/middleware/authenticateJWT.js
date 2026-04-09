const { User } = require("../modules/user/userModel.js");
const { Hostel } = require("../modules/hostel/hostelModel.js");
const AppError = require("../utils/appError.js");
const jwt = require("jsonwebtoken");
const redisClient = require("../utils/redisClient.js");

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
        return next(new AppError(401, "Access token expired"));
      }
      if (err instanceof AppError) return next(err);

      console.error("Error verifying token:", err);
      return next(new AppError(500, "Server error during authentication"));
    }
  };
}

const authenticateJWT = auth(User, "user");
const authenticateAdminJWT = auth(Hostel, "hostel");

const authenticateUserOrAdminJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    let lastError = null;

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
      lastError = err;
    }

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

    if (lastError) console.error("Error verifying token:", lastError);
    return next(new AppError(403, "Not Authenticated"));
  } catch (err) {
    return next(err);
  }
};

const authenticateHabJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
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
const authenticateMessManagerJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    const hostel = await Hostel.findByAccessToken(token);
    if (!hostel) return next(new AppError(403, "Not Authenticated as manager"));

    req.managerHostel = hostel;
    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error("Error verifying Mess Manager token:", err);
    return next(new AppError(500, "Server error during authentication"));
  }
};

const authenticateHabOrSMCJWT = async (req, res, next) => {
  try {
    const token = await extractAndCheckToken(req);
    let lastError = null;

    try {
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
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

module.exports = {
  authenticateJWT,
  authenticateAdminJWT,
  authenticateUserOrAdminJWT,
  authenticateHabJWT,
  authenticateMessManagerJWT,
  authenticateHabOrSMCJWT,
};
