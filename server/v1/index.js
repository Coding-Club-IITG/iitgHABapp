import path from "path";
const __dirname = import.meta.dirname;
import { port, publicBaseUrl, mongodbUri } from "./config/default.js";

import installProcessHandlers from "../processHandlers.js";
installProcessHandlers();

import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { randomUUID } from "crypto";
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
import galaRoute from "./modules/gala/galaRoute.js";
import messChangeRoute from "./modules/mess_change/messchangeRoute.js";
import profileRoute from "./modules/profile/profileRoute.js";
import festivalModeRoute from "./modules/festival_mode/festivalModeRoute.js";
import appRoute from "./modules/app/appRoute.js";
import debugRoute from "./modules/debug/debugRoute.js";
import summerMessRoute from "./modules/summer_mess/summerMessRoute.js";

import { initializeAnonymizedUser } from "./modules/user/anonymizedUserInit.js";
import { initMessManagerWs } from "./modules/mess/messManagerWs.js";
import { initGalaManagerWs } from "./modules/gala/galaManagerWs.js";
import { initScanBroadcast } from "./utils/scanBroadcast.js";
import { initDelegatedGraphRedis } from "./utils/delegatedGraphAuth.js";

import { opsHttpTelemetry } from "./telemetry/http.js";

const app = express();

// Generate correlation locally; never persist incoming headers or identity data
app.use((req, res, next) => {
  req.opsCorrelationId = randomUUID();
  req.headers["x-request-id"] = req.opsCorrelationId;
  next();
});
app.use(opsHttpTelemetry);

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

// User route
app.use("/api/users", userRoute);

// app.use("/api/complaints", complaintRoute);

// Feedback route
app.use("/api/feedback", feedbackRoute);

// Auth route
app.use("/api/auth", authRoutes);

// Hostel route
app.use("/api/hostel", hostelRoute);

// Notification route
app.use("/api/notification", notificationRoute);

// Mess route
app.use("/api/mess", messRoute);

// Gala Dinner route
app.use("/api/gala", galaRoute);

// Mess Rebate route
app.use("/api/leave", leaveRoute);

// Mess Change route
app.use("/api/mess-change", messChangeRoute);

// Profile route
app.use("/api/profile", profileRoute);

// Scan logs route
app.use("/api/logs", logsRoute);

// Bug report route
app.use("/api/bug-report", bugReportRoute);

// Room cleaning availability route
app.use("/api/room-cleaning", roomCleaningRoute);

// Laundry service route
app.use("/api/laundry", laundryRoute);

// Festival mode route
app.use("/api/festival-mode", festivalModeRoute);

// Summer mess route
app.use("/api/summer-mess", summerMessRoute);

// App bootstrap route
app.use("/api/app", appRoute);

// Server Debug route
app.use("/api/_debug", debugRoute);

// Global error handler (must be after all routes)
// Catches errors passed to next(err)
app.use((err, req, res, next) => {
  console.error("[Express error]", err);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

// STARTUP
let server;

async function bootstrap() {
  if (!mongodbUri) {
    console.error("mongodbUri is not set, refusing to start.");
    process.exit(1);
  }

  await mongoose.connect(mongodbUri);
  console.log("MongoDB connected");

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

  // Stop accepting new HTTP connections
  if (server) {
    server.close(() => {
      console.log("✅ HTTP server closed");
    });
  }

  // Close Mongoose connection
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
