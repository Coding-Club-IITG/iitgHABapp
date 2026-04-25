import jwt from "jsonwebtoken";
import { User } from "../modules/user/userModel.js";
import AppError from "../utils/appError.js";
import { debugMail, debugKey, jwtSecret } from "../config/default.js";

export const requireDebugAuth = async (req, res, next) => {
  try {
    // Check for Key
    const providedKey = req.headers["x-debug-key"];
    if (debugKey && providedKey === debugKey) {
      return next();
    }

    // Fallback: Check for valid JWT
    let token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ") &&
        req.headers.authorization.split(" ")[1]);

    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findById(decoded.user);

        if (user && user.email === debugMail && !user.isBanned) {
          req.user = user;
          return next();
        }
      } catch (err) {
        // Token invalid, fall through to error
      }
    }

    // Deny if neither matches
    return next(
      new AppError(
        403,
        "Access denied: Valid x-debug-key or debug user session required",
      ),
    );
  } catch (err) {
    next(err);
  }
};
