import path from "path";
const __dirname = import.meta.dirname;
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const nodeENV = process.env.NODE_ENV || "development";
export const port = process.env.PORT_V1 || 3001;
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
