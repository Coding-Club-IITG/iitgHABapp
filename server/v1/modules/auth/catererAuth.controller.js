import crypto from "crypto";
import { getHqAuth } from "./hqFirebaseAdmin.js";

import { Hostel } from "../hostel/hostelModel.js";
import { Mess } from "../mess/messModel.js";
import CatererSession from "./catererSession.model.js";
import {
  hqCatererAllowAnyGoogleEmail,
  hqCatererFallbackHostelName,
} from "../../config/default.js";

const REFRESH_DAYS = Number(process.env.CATERER_REFRESH_DAYS || 30);

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

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveFallbackHostel() {
  const configuredName = String(hqCatererFallbackHostelName || "").trim();
  if (!configuredName) return null;

  let hostel = await Hostel.findOne({ hostel_name: configuredName });
  if (hostel) return hostel;

  hostel = await Hostel.findOne({
    hostel_name: { $regex: `^${escapeRegex(configuredName)}$`, $options: "i" },
  });
  if (hostel) return hostel;

  if (configuredName.toLowerCase().startsWith("lohit")) {
    hostel = await Hostel.findOne({
      hostel_name: { $regex: "^lohit( hostel)?$", $options: "i" },
    });
  }
  return hostel;
}

async function resolveMessForHostel(hostel) {
  if (hostel?.messId) {
    const linkedMess = await Mess.findById(hostel.messId);
    if (linkedMess) return linkedMess;
  }
  return Mess.findOne({ hostelId: hostel._id });
}

/**
 * POST /api/auth/caterer/google
 * Body: { idToken: string }
 */
export const catererGoogleLoginHandler = async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({
        success: false,
        message: "idToken is required",
      });
    }

    let decoded;
    try {
      decoded = await getHqAuth().verifyIdToken(idToken);
    } catch (err) {
      console.error("catererGoogleLogin verifyIdToken:", err?.message || err);
      return res.status(401).json({
        success: false,
        message: "Invalid Firebase token",
      });
    }

    const email = (decoded?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Signed-in account has no email",
      });
    }
    if (decoded?.email_verified === false) {
      return res.status(401).json({
        success: false,
        message: "Google email is not verified",
      });
    }

    let mess = await Mess.findOne({ managerGoogleEmail: email });
    let hostel = mess ? await resolveHostelForMess(mess) : null;
    let authType = "caterer_google";

    if (!mess || !hostel) {
      if (!hqCatererAllowAnyGoogleEmail) {
        const message = !mess
          ? "This Google account is not registered for any caterer (mess)"
          : "No hostel linked to this caterer";
        return res.status(403).json({ success: false, message });
      }

      hostel = await resolveFallbackHostel();
      if (!hostel) {
        return res.status(503).json({
          success: false,
          message:
            "Reviewer fallback hostel is not configured. Set HQ_CATERER_FALLBACK_HOSTEL_NAME to an existing hostel.",
        });
      }

      mess = await resolveMessForHostel(hostel);
      if (!mess) {
        return res.status(503).json({
          success: false,
          message: "No mess linked to fallback hostel",
        });
      }

      authType = "caterer_google_fallback";
    }

    const rawRefresh = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

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
      authType,
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
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

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
      return res
        .status(400)
        .json({ success: false, message: "refreshToken is required" });
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
