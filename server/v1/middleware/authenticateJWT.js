const { User } = require("../modules/user/userModel.js");
const { Hostel } = require("../modules/hostel/hostelModel.js");
const AppError = require("../utils/appError.js");
const jwt = require("jsonwebtoken");

function auth(Schema, param) {
  return async function (req, res, next) {
    let token = req.cookies?.token;

    //console.log("Verifying tokeninauth:", req.headers.authorization);

    // Check for token in headers if not in cookies
    if (req.headers?.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else {
        console.log("Authorization header format is invalid");
      }
    }
    // Log the source of the token
    if (token) {
      // console.log("Token received from client:", token);
    } else {
      console.log("No token provided by the client");
    }

    // If token is missing, send error response
    if (!token) return next(new AppError(403, "Invalid token"));

    try {
      // Validate the token and find the element

      const found = await Schema.findByJWT(token);
      //console.log("Found user/hostel:", found);
      if (!found) return next(new AppError(403, "Not Authenticated"));

      // Attach the param to the request object
      req[param] = found;
      return next();
    } catch (err) {
      console.error("Error verifying token:", err);
      return next(new AppError(500, "Server error during authentication"));
    }
  };
}

const authenticateJWT = auth(User, "user");
const authenticateAdminJWT = auth(Hostel, "hostel");

const authenticateUserOrAdminJWT = async (req, res, next) => {
  let token = req.cookies?.token;

  if (req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) return next(new AppError(403, "Invalid token"));

  try {
    const user = await User.findByJWT(token);
    if (user) {
      req.user = user;
      return next();
    }

    const hostel = await Hostel.findByJWT(token);
    if (hostel) {
      req.hostel = hostel;
      return next();
    }

    return next(new AppError(403, "Not Authenticated"));
  } catch (err) {
    console.error("Error verifying token:", err);
    return next(new AppError(500, "Server error during authentication"));
  }
};

const authenticateHabJWT = async (req, res, next) => {
  let token = req.cookies?.token;

  if (req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) return next(new AppError(403, "Invalid token"));

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (!decoded?.hab) return next(new AppError(403, "Not Authenticated"));

    req.hab = decoded;
    return next();
  } catch (err) {
    console.error("Error verifying HAB token:", err);
    return next(new AppError(403, "Not Authenticated"));
  }
};

// Dedicated middleware for HABit HQ / mess-manager app.
// Validates a hostel JWT (same token as hostel frontend) and attaches
// the hostel document as `req.managerHostel`.
const authenticateMessManagerJWT = async (req, res, next) => {
  let token;

  if (req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) return next(new AppError(403, "Invalid token"));

  try {
    const hostel = await Hostel.findByJWT(token);
    if (!hostel) return next(new AppError(403, "Not Authenticated as manager"));

    req.managerHostel = hostel;
    return next();
  } catch (err) {
    console.error("Error verifying Mess Manager token:", err);
    return next(new AppError(500, "Server error during authentication"));
  }
};

module.exports = {
  authenticateJWT,
  authenticateAdminJWT,
  authenticateUserOrAdminJWT,
  authenticateHabJWT,
  authenticateMessManagerJWT,
};
