import path from "path";
const __dirname = import.meta.dirname;
import { nodeENV, port, publicBaseUrl, mongodbUri } from "./config/default.js";
import onedrive from "./config/onedrive.js";

import { installProcessHandlers } from "../processHandlers.js";
installProcessHandlers();

import axios from "axios";
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import winston from "winston";
import expressWinston from "express-winston";
import { randomUUID } from "crypto";
import { Worker } from "worker_threads";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoute from "./modules/user/userRoute.js";
import feedbackRoute from "./modules/feedback/feedbackRoute.js";
import hostelRoute from "./modules/hostel/hostelRoute.js";
import notificationRoute from "./modules/notification/notificationRoute.js";
import messRoute from "./modules/mess/messRoute.js";
import leaveRoute from "./modules/leave/leaveRoute.js";
import logsRoute from "./modules/mess/ScanLogsRoute.js";
import bugReportRoute from "./modules/bug_report/bugReportRoute.js";
import roomCleaningRoute from "./modules/room_cleaning/roomCleaningRoute.js";
import laundryRoute from "./modules/laundry/laundryRoute.js";
import alertRoutes from "./modules/alert/alertRoute.js";
import galaRoute from "./modules/gala/galaRoute.js";
import messChangeRoute from "./modules/mess_change/messchangeRoute.js";
import profileRoute from "./modules/profile/profileRoute.js";

import agenda from "./utils/agenda.js";
import { initializeFeedbackAutoScheduler } from "./modules/feedback/autoFeedbackScheduler.js";
import { initializeMessChangeAutoScheduler } from "./modules/mess_change/autoMessChangeScheduler.js";
import { initializeMessAllotmentScheduler } from "./modules/mess_change/allotmentScheduler.js";
import { initializeAnonymizedUser } from "./modules/user/anonymizedUserInit.js";
import { initializeGuestCleanupScheduler } from "./modules/auth/autoGuestCleanupScheduler.js";
import { initializeMessRebateAutoScheduler } from "./modules/leave/autoMessRebateScheduler.js";
import { initializeRoomCleaningAutoResolveScheduler } from "./modules/room_cleaning/autoRoomCleaningResolveScheduler.js";

import { initMessManagerWs } from "./modules/mess/messManagerWs.js";
import { initGalaManagerWs } from "./modules/gala/galaManagerWs.js";
import { initScanBroadcast } from "./utils/scanBroadcast.js";

import storeLogs from "./middleware/logger.js";

import {
  setDelegatedTokens,
  tokenFilePath,
  initDelegatedGraphRedis,
} from "./utils/delegatedGraphAuth.js";

// Build delegated auth URLs for starting consent
function buildAuthorizeUrl() {
  // For delegated token flow, use a dedicated callback endpoint
  // Use publicBaseUrl if available, otherwise try to construct from request
  const delegatedRedirectUri = `${publicBaseUrl}/api/_debug/graph/callback`;

  const params = new URLSearchParams({
    client_id: onedrive.clientId,
    response_type: "code",
    redirect_uri: delegatedRedirectUri,
    scope:
      (onedrive.graphUserScopes || []).join(" ") || "offline_access User.Read",
    prompt: "consent",
  });
  return `https://login.microsoftonline.com/${onedrive.authTenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));
app.use(
  compression({
    level: 6,
    threshold: 100,
  }),
);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IITG HAB API",
      version: "1.0.0",
      description: "API documentation for IITG HAB application",
      contact: {
        name: "API Support",
        email: "md.hassan@iitg.ac.in",
      },
    },
    servers: [
      {
        url: "https://hab.codingclub.in",
        description: "Production server",
      },
      {
        url: `http://localhost:${port}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./modules/**/*.js", "index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware to assign a unique request ID for better log correlation
app.use((req, res, next) => {
  req.headers["x-request-id"] = req.headers["x-request-id"] || randomUUID();
  next();
});

// Custom Winston transport to handle log storage (e.g., database, file)
class CustomTransport extends winston.Transport {
  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    // Send full log object somewhere
    console.log(info.message);
    storeLogs(info);
    callback();
  }
}

// Example function to handle log data
app.use(
  expressWinston.logger({
    transports: [new CustomTransport()],

    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),

    meta: true,
    msg: "[{{req.headers['x-request-id']}}] HTTP {{req.method}} {{req.url}} {{res.statusCode}}",
    expressFormat: true,
    colorize: false,

    // Use status code to determine log level (500=error, 400=warn, etc.)
    statusLevels: true,

    // IMPORTANT: By default, headers and body are NOT logged.
    // You must whitelist them here:
    requestWhitelist: ["url", "method", "query", "body"],
    responseWhitelist: ["statusCode", "body"],

    // ADDED: Crucial metadata for debugging at scale
    dynamicMeta: (req, res) => {
      return {
        correlationId: req.headers["x-request-id"],
        user: req.body?.username || "anonymous",
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        userAgent: req.get("User-Agent") || "unknown",
        env: nodeENV,
      };
    },
    // This replaces the value of 'password' with '*****' in the logs
    bodyBlacklist: ["password", "secret", "token"],
  }),
);

function startWorker() {
  const worker = new Worker(
    path.resolve(__dirname, "./workers/loggerWorker.js"),
    // PM2 injects --max-old-space-size=… into process.execArgv
    // Worker threads reject it (ERR_WORKER_INVALID_EXEC_ARGV)
    { execArgv: [] },
  );

  worker.on("error", (err) => console.error("Worker Error:", err));
  worker.on("exit", (code) => {
    if (code !== 0) console.error(`Worker stopped with exit code ${code}`);
  });
}

startWorker();

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "IITG HAB API Documentation",
  }),
);

app.get("/api/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://hab.codingclub.in",
      "https://hostel.codingclub.in",
      "https://smc.codingclub.in",
      "http://localhost:5172",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

/**
 * @swagger
 * /:
 *  get:
 *     summary: "Health check endpoint"
 *     tags: ["Health"]
 *     responses:
 *      200:
 *       description: "Backend is running"
 */
app.get("/", (req, res) => {
  res.send("Backend is running");
});

/**
 * @swagger
 * /hello:
 *    get:
 *      summary: "Health check hello endpoint"
 *      tags: ["Health"]
 *      responses:
 *        200:
 *          description: "Hello from server"
 */
app.get("/hello", (req, res) => {
  res.send("Hello from server");
});

// User route
app.use("/api/users", userRoute);

// app.use("/api/complaints", complaintRoute);

// Feedback route
app.use("/api/feedback", feedbackRoute);

// auth route
app.use("/api/auth", authRoutes);

// hostel route
app.use("/api/hostel", hostelRoute);

// notification route
app.use("/api/notification", notificationRoute);

// Mess route
app.use("/api/mess", messRoute);

// Gala Dinner route
app.use("/api/gala", galaRoute);

// Mess Rebate route
app.use("/api/leave", leaveRoute);

// mess change route
app.use("/api/mess-change", messChangeRoute);

// alert route
app.use("/api/alerts", alertRoutes);

// profile route
app.use("/api/profile", profileRoute);

// scanlogs route
app.use("/api/logs", logsRoute);

// Bug report route
app.use("/api/bug-report", bugReportRoute);

// Room cleaning availability route
app.use("/api/room-cleaning", roomCleaningRoute);

// Laundry service route
app.use("/api/laundry", laundryRoute);

// Debug route: accept delegated tokens and save to disk for server use
// WARNING: Protect this route in production (e.g., require admin auth, restrict IPs)
app.post("/api/_debug/graph/delegated-token", async (req, res) => {
  try {
    const { access_token, refresh_token, expires_at } = req.body || {};
    if (!access_token || !refresh_token || !expires_at) {
      return res.status(400).json({
        message: "access_token, refresh_token, expires_at (epoch ms) required",
      });
    }
    await setDelegatedTokens({ access_token, refresh_token, expires_at });
    return res
      .status(200)
      .json({ message: "Delegated tokens saved", path: tokenFilePath });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to save delegated tokens",
      error: String(e.message || e),
    });
  }
});

// Debug route: start delegated auth (prints URL)
app.get("/api/_debug/graph/start", (req, res) => {
  if (!onedrive.clientId) {
    return res.status(400).json({ message: "CLIENT_ID missing" });
  }
  const url = buildAuthorizeUrl();
  return res.status(200).json({ authorizeUrl: url });
});

// Debug route: delegated auth callback (exchange code -> tokens)
app.get("/api/_debug/graph/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing code");
    const tokenUrl = `https://login.microsoftonline.com/${
      onedrive.authTenant || onedrive.tenantId || "common"
    }/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", onedrive.clientId);
    if (onedrive.clientSecret)
      params.append("client_secret", onedrive.clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    // Use the same redirect URI that was used in the authorization request
    const delegatedRedirectUri = `${publicBaseUrl}/api/_debug/graph/callback`;
    params.append("redirect_uri", delegatedRedirectUri);
    params.append(
      "scope",
      (onedrive.graphUserScopes || []).join(" ") || "offline_access User.Read",
    );

    const { data } = await axios.post(tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
    await setDelegatedTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    });
    res
      .status(200)
      .send(
        `Delegated tokens saved at ${tokenFilePath}. You can close this window.`,
      );
  } catch (e) {
    res.status(500).send(`Failed to exchange code: ${e.message}`);
  }
});

// Global error handler (must be after all routes)
// Catches errors passed to next(err)
app.use((err, req, res, next) => {
  console.error("[Express error]", err);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

// STARTUP - listen only after MongoDB is ready so auth queries are not buffered until timeout
let server;

async function bootstrap() {
  if (!mongodbUri) {
    console.error("mongodbUri is not set, refusing to start.");
    process.exit(1);
  }

  await mongoose.connect(mongodbUri);
  console.log("MongoDB connected");

  await agenda.start();
  console.log("[Agenda] Job processor started");

  initializeFeedbackAutoScheduler();
  initializeMessChangeAutoScheduler();
  initializeMessAllotmentScheduler();
  initializeMessRebateAutoScheduler();
  initializeRoomCleaningAutoResolveScheduler();
  initializeGuestCleanupScheduler();
  await initializeAnonymizedUser();

  server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Current Time: ${new Date().toLocaleString()}`);
    if (process.send) process.send("ready");
  });

  initMessManagerWs(server);
  initGalaManagerWs(server);
  initScanBroadcast();
  initDelegatedGraphRedis();
}

bootstrap().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

// SHUTDOWN
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutdown initiated...`);

  // 1. Stop accepting new HTTP connections
  if (server) {
    server.close(() => {
      console.log("✅ HTTP server closed");
    });
  }

  // 2. Stop Agenda from picking up new jobs and wait for running jobs to finish
  try {
    await agenda.stop();
    console.log("✅ Agenda stopped");
  } catch (err) {
    console.error("❌ Agenda stop error:", err);
  }

  // 3. Close Mongoose connection
  try {
    await mongoose.connection.close();
    console.log("✅ Mongoose connection closed");
  } catch (err) {
    console.error("❌ Mongoose close error:", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
