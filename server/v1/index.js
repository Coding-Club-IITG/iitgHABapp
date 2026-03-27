// server/v1/index.js
//import authRoutes from "./modules/auth/auth.routes.js";

require("dotenv").config({ path: "../.env" });
const { installProcessHandlers } = require("../processHandlers.js");
installProcessHandlers();
const authRoutes = require("./modules/auth/auth.routes.js");
const express = require("express");
const mongoose = require("mongoose");
const userRoute = require("./modules/user/userRoute.js");
const cookieParser = require("cookie-parser");
const feedbackRoute = require("./modules/feedback/feedbackRoute.js");
const hostelRoute = require("./modules/hostel/hostelRoute.js");
const notificationRoute = require("./modules/notification/notificationRoute.js");
const messRoute = require("./modules/mess/messRoute.js");
const leaveRoute = require("./modules/leave/leaveRoute.js");
const logsRoute = require("./modules/mess/ScanLogsRoute.js");
const bugReportRoute = require("./modules/bug_report/bugReportRoute.js");
const roomCleaningRoute = require("./modules/room_cleaning/roomCleaningRoute.js");
const laundryRoute = require("./modules/laundry/laundryRoute.js");

const compression = require("compression");

const cors = require("cors");
const bodyParser = require("body-parser");
const winston = require("winston");
const expressWinston = require("express-winston");
const storeLogs = require("./middleware/logger.js");
const { v4: uuidv4 } = require("uuid");
const { Worker } = require("worker_threads");
const path = require("path");
const {
  setDelegatedTokens,
  tokenFilePath,
  initDelegatedGraphRedis,
} = require("./utils/delegatedGraphAuth.js");

// New: build delegated auth URLs for starting consent
const onedrive = require("./config/onedrive.js");
function buildAuthorizeUrl() {
  // For delegated token flow, use a dedicated callback endpoint
  // Use PUBLIC_BASE_URL if available, otherwise try to construct from request
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://hab.codingclub.in";
  const delegatedRedirectUri = `${baseUrl}/api/_debug/graph/callback`;

  const params = new URLSearchParams({
    client_id: onedrive.clientId,
    response_type: "code",
    redirect_uri: delegatedRedirectUri,
    scope:
      (onedrive.graphUserScopes || []).join(" ") || "offline_access User.Read",
    prompt: "consent",
  });
  const tenant = onedrive.authTenant || onedrive.tenantId || "common";
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const {
  initializeFeedbackAutoScheduler,
} = require("./modules/feedback/autoFeedbackScheduler.js");

const {
  initializeMessChangeAutoScheduler,
} = require("./modules/mess_change/autoMessChangeScheduler.js");
const {
  initializeGuestCleanupScheduler,
} = require("./modules/auth/autoGuestCleanupScheduler.js");
const {
  initializeMessRebateAutoScheduler,
} = require("./modules/leave/autoMessRebateScheduler.js");
const {
  initializeAnonymizedUser,
} = require("./modules/user/anonymizedUserInit.js");

const {
  initializeRoomCleaningAutoResolveScheduler,
} = require("./modules/room_cleaning/autoRoomCleaningResolveScheduler.js");
const messChangeRouter = require("./modules/mess_change/messchangeRoute.js");
const galaRoute = require("./modules/gala/galaRoute.js");
require("dotenv").config();

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));
app.use(
  compression({
    level: 6,
    threshold: 100,
  }),
);

const MONGOdb_uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3001;

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
        url: `http://localhost:${PORT}`,
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
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Custom Winston transport to handle log storage (e.g., database, file)
class CustomTransport extends winston.Transport {
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Send full log object somewhere
    console.log(info.message);
    storeLogs(info);
    callback();
  }
}


// Example function to handle log data
app.use(expressWinston.logger({
  transports: [
    new CustomTransport()
  ],

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),

  meta: true,
  msg: "[{{req.headers['x-request-id']}}] HTTP {{req.method}} {{req.url}} {{res.statusCode}}",
  expressFormat: true,
  colorize: false,

  // Use status code to determine log level (500=error, 400=warn, etc.)
  statusLevels: true,

  // IMPORTANT: By default, headers and body are NOT logged.
  // You must whitelist them here:
  requestWhitelist: ['url', 'method', 'query', 'body'],
  responseWhitelist: ['statusCode', 'body'],

  // ADDED: Crucial metadata for debugging at scale
  dynamicMeta: (req, res) => {
    return {
      correlationId: req.headers['x-request-id'],
      user: req.body?.username || 'anonymous',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.get('User-Agent') || 'unknown',
      env: process.env.NODE_ENV || 'development'
    };
  },
  // This replaces the value of 'password' with '*****' in the logs
  bodyBlacklist: ['password', 'secret', 'token'],
}));

function startWorker() {
  const worker = new Worker(path.resolve(__dirname, "./workers/loggerWorker.js"));
  
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

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");

    // Only run schedulers on the primary PM2 instance
    if (
      process.env.NODE_APP_INSTANCE === "0" ||
      typeof process.env.NODE_APP_INSTANCE === "undefined"
    ) {
      console.log("Primary instance detected. Starting schedulers...");
      initializeFeedbackAutoScheduler();
      initializeMessChangeAutoScheduler();
      initializeGuestCleanupScheduler();
      initializeMessRebateAutoScheduler();
      initializeRoomCleaningAutoResolveScheduler();
    } else {
      console.log(
        `Worker instance ${process.env.NODE_APP_INSTANCE} started. Schedulers disabled here.`,
      );
    }

    // Initialize anonymized user for soft-deleted account references
    initializeAnonymizedUser();
  })
  .catch((err) => console.log(err));

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

// user route
app.use("/api/users", userRoute);

// app.use("/api/complaints", complaintRoute);

// Feedback route
app.use("/api/feedback", feedbackRoute);

//auth route
app.use("/api/auth", authRoutes);

//hostel route
app.use("/api/hostel", hostelRoute);

//notification route
app.use("/api/notification", notificationRoute);

// Mess route
app.use("/api/mess", messRoute);

// Gala Dinner route
app.use("/api/gala", galaRoute);
// Mess rebate route
app.use("/api/leave", leaveRoute);

//mess change route
app.use("/api/mess-change", messChangeRouter);

// profile route
const profileRouter = require("./modules/profile/profileRoute.js");
app.use("/api/profile", profileRouter);

//scanlogs route
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
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://hab.codingclub.in";
    const delegatedRedirectUri = `${baseUrl}/api/_debug/graph/callback`;
    params.append("redirect_uri", delegatedRedirectUri);
    params.append(
      "scope",
      (onedrive.graphUserScopes || []).join(" ") || "offline_access User.Read",
    );

    const axios = require("axios");
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

// Global error handler (must be after all routes). Catches errors passed to next(err).
app.use((err, req, res, next) => {
  console.error("[Express error]", err);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

const { initMessManagerWs } = require("./modules/mess/messManagerWs.js");
const { initGalaManagerWs } = require("./modules/gala/galaManagerWs.js");

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Initialize WebSocket servers for manager live scan logs
initMessManagerWs(server);
initGalaManagerWs(server);

// Subscribe to Redis scan events so all cluster instances can broadcast to their local WS clients
const { initScanBroadcast } = require("./utils/scanBroadcast.js");
initScanBroadcast();

// Connect to Redis and backfill delegated Graph token from disk so first request can use Redis
initDelegatedGraphRedis();

module.exports = app;
