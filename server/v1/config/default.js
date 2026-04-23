import path from "path";
const __dirname = import.meta.dirname;
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const API_VERSION = "v1";
export const REDIS_KEY_PREFIX = `hab:${API_VERSION}:`;
export const ENABLE_SCHEDULERS = API_VERSION === "v1";
export const ENABLE_MESS_CHANGE_FLOW =
  process.env.ENABLE_MESS_CHANGE_FLOW === "true" || false;

export const nodeENV = process.env.NODE_ENV || "development";
export const port =
  process.env[`PORT_${API_VERSION.toUpperCase()}`] ||
  (API_VERSION === "v1" ? 3001 : 3002);

export const mongodbUri = process.env.MONGODB_URI;
export const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const postgresUrl =
  process.env.POSTGRES_URL ||
  "postgresql://postgres:postgres@localhost:5433/postgres";

export const refreshSecret = process.env.REFRESH_SECRET;
export const jwtSecret = process.env.JWT_SECRET;
export const adminJwtSecret = process.env.ADMIN_JWT_SECRET;

export const publicBaseUrl =
  process.env.PUBLIC_BASE_URL || "https://hab.codingclub.in";
export const webRedirectUri = process.env.WEB_REDIRECT_URI;
export const mobileUrl = process.env.MOBILE_URL;

export const habEmail = process.env.HAB_EMAIL;
export const habEmail2 = process.env.HAB_EMAIL_2;
export const habFrontendUrl = process.env.HAB_FRONTEND_URL;
export const hostelFrontendUrl = process.env.HOSTEL_FRONTEND_URL;
export const smcFrontendUrl = process.env.SMC_FRONTEND_URL;

export const stationLeave = {
  latexTimeout: process.env.STATION_LEAVE_LATEX_TIMEOUT_MS,
  latexImage: process.env.STATION_LEAVE_LATEX_IMAGE,
  dockerBin: process.env.STATION_LEAVE_DOCKER_BIN || "docker",
};

/**
 * HABit HQ reviewer mode.
 * - When true, any verified Google email can sign in to caterer flow.
 * - If no mess mapping exists, user is attached to fallback hostel.
 */
export const hqCatererAllowAnyGoogleEmail =
  (process.env.HQ_CATERER_ALLOW_ANY_GOOGLE_EMAIL || "false")
    .trim()
    .toLowerCase() === "true";

export const hqCatererFallbackHostelName =
  process.env.HQ_CATERER_FALLBACK_HOSTEL_NAME || "Lohit";
