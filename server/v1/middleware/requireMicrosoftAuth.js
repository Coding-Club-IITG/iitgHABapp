const AppError = require("../utils/appError.js");

/**
 * Middleware to require Microsoft account linking (roll number verification)
 * Use this for features that require a valid student roll number
 */
const requireMicrosoftAuth = async (req, res, next) => {
  const user = req.user; // From authenticateJWT middleware

  if (!user || !user.hasMicrosoftLinked || !user.rollNumber) {
    return next(
      new AppError(
        403,
        "Microsoft account linking required for this feature"
      )
    );
  }

  next();
};

module.exports = { requireMicrosoftAuth };
