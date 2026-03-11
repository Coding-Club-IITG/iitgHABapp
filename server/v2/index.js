// server/v2/index.js
//import authRoutes from "./modules/auth/auth.routes.js";

require("dotenv").config({ path: "../.env" });
const { installProcessHandlers } = require("../processHandlers.js");
installProcessHandlers();
console.log("MONGODB_URI from env:", process.env.MONGODB_URI);
const authRoutes = require("./modules/auth/auth.routes.js");
const express = require("express");
const mongoose = require("mongoose");
const userRoute = require("./modules/user/userRoute.js");
const cookieParser = require("cookie-parser");
const feedbackRoute = require("./modules/feedback/feedbackRoute.js");
const hostelRoute = require("./modules/hostel/hostelRoute.js");
const notificationRoute = require("./modules/notification/notificationRoute.js");
const messRoute = require("./modules/mess/messRoute.js");
const logsRoute = require("./modules/mess/ScanLogsRoute.js");
const cors = require("cors");
const bodyParser = require("body-parser");
const {
  setDelegatedTokens,
  tokenFilePath,
} = require("./utils/delegatedGraphAuth.js");

// New: build delegated auth URLs for starting consent
const onedrive = require("./config/onedrive.js");
function buildAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: onedrive.clientId,
    response_type: "code",
    redirect_uri:
      onedrive.redirectUri ||
      `${
        process.env.PUBLIC_BASE_URL || "https://hab.codingclub.in"
      }/api/_debug/graph/callback`,
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
  wednesdayScheduler,
  sundayScheduler,
} = require("./modules/hostel/hostelScheduler.js");
const {
  initializeFeedbackAutoScheduler,
} = require("./modules/feedback/autoFeedbackScheduler.js");

const {
  initializeMessChangeAutoScheduler,
} = require("./modules/mess_change/autoMessChangeScheduler.js");
const messChangeRouter = require("./modules/mess_change/messchangeRoute.js");
require("dotenv").config();

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));

const MONGOdb_uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3002;

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
  .connect(MONGOdb_uri)
  .then(() => {
    console.log("MongoDB connected");

    // wednesdayScheduler();

    // sundayScheduler();

    // // Initialize automatic schedulers for feedback and mess change
    // initializeFeedbackAutoScheduler();
    // initializeMessChangeAutoScheduler();
    console.log("⚠️ V2 Schedulers DISABLED (Running on V1 only)");
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

//mess change route
app.use("/api/mess-change", messChangeRouter);

// profile route
const profileRouter = require("./modules/profile/profileRoute.js");
app.use("/api/profile", profileRouter);

//scanlogs route
app.use("/api/logs", logsRoute);

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
    params.append(
      "redirect_uri",
      onedrive.redirectUri ||
        `${
          process.env.PUBLIC_BASE_URL || "https://hab.codingclub.in"
        }/api/_debug/graph/callback`,
    );
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
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
