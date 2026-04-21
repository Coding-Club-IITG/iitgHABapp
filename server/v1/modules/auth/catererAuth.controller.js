import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { Hostel } from "../hostel/hostelModel.js";
import { Mess } from "../mess/messModel.js";
import CatererSession from "./catererSession.model.js";
import { googleHqClientIds } from "../../config/default.js";

const REFRESH_DAYS = Number(process.env.CATERER_REFRESH_DAYS || 30);

const oauthClient = new OAuth2Client();

function hashRefreshToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function resolveHostelForMess(mess) {
  if (mess.hostelId) {
    const h = await Hostel.findById(mess.hostelId);
    if (h) return h;
  }
  return Hostel.findOne({ messId: mess._id });
}

/**
 * POST /api/auth/caterer/google
 * Body: { idToken: string }
 */
export const catererGoogleLoginHandler = async (req, res, next) => {
  try {
    if (!googleHqClientIds.length) {
      return res.status(503).json({
        success: false,
        message: "Caterer Google login is not configured (GOOGLE_HQ_CLIENT_IDS)",
      });
    }

    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({
        success: false,
        message: "idToken is required",
      });
    }

    let payload;
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: googleHqClientIds,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error("catererGoogleLogin verifyIdToken:", err?.message || err);
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const email = (payload.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Google account has no email",
      });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({
        success: false,
        message: "Google email is not verified",
      });
    }

    const mess = await Mess.findOne({ managerGoogleEmail: email });
    if (!mess) {
      return res.status(403).json({
        success: false,
        message: "This Google account is not registered for any caterer (mess)",
      });
    }

    const hostel = await resolveHostelForMess(mess);
    if (!hostel) {
      return res.status(403).json({
        success: false,
        message: "No hostel linked to this caterer",
      });
    }

    const rawRefresh = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(
      Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000,
    );

    await CatererSession.create({
      mess: mess._id,
      hostel: hostel._id,
      refreshToken: rawRefresh,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiresAt,
    });

    const accessToken = hostel.generateJWT();

    return res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken: rawRefresh,
      hostelName: hostel.hostel_name,
      messId: mess._id.toString(),
      authType: "caterer_google",
    });
  } catch (err) {
    console.error("catererGoogleLoginHandler:", err);
    next(err);
  }
};

/**
 * POST /api/auth/caterer/refresh
 * Body: { refreshToken: string }
 */
export const catererRefreshHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== "string") {
      return res.status(401).json({
        success: false,
        message: "refreshToken is required",
      });
    }

    const hashed = hashRefreshToken(refreshToken);

    const session = await CatererSession.findOne({
      refreshToken: hashed,
      isRevoked: false,
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid or revoked refresh session",
      });
    }

    if (session.expiresAt < new Date()) {
      session.isRevoked = true;
      await session.save();
      return res.status(403).json({
        success: false,
        message: "Session expired",
      });
    }

    const hostel = await Hostel.findById(session.hostel);
    if (!hostel) {
      session.isRevoked = true;
      await session.save();
      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }

    session.isRevoked = true;
    await session.save();

    const rawRefresh = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(
      Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000,
    );

    await CatererSession.create({
      mess: session.mess,
      hostel: session.hostel,
      refreshToken: rawRefresh,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiresAt,
    });

    const accessToken = hostel.generateJWT();

    return res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken: rawRefresh,
      hostelName: hostel.hostel_name,
      authType: "caterer_google",
    });
  } catch (err) {
    console.error("catererRefreshHandler:", err);
    next(err);
  }
};

/**
 * POST /api/auth/caterer/logout
 * Body: { refreshToken: string }
 */
export const catererLogoutHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== "string") {
      return res.status(400).json({ success: false, message: "refreshToken is required" });
    }

    const hashed = hashRefreshToken(refreshToken);
    const session = await CatererSession.findOne({ refreshToken: hashed });
    if (session) {
      session.isRevoked = true;
      await session.save();
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("catererLogoutHandler:", err);
    next(err);
  }
};
