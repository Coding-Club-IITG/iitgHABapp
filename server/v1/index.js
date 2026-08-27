import path from "path";
const __dirname = import.meta.dirname;
import {
  API_VERSION,
  port,
  publicBaseUrl,
  mongodbUri,
} from "./config/default.js";

import installProcessHandlers from "../processHandlers.js";
import {
  configureLogging,
  flushLogging,
  logger,
  opsHttpMiddleware,
} from "./logging/logger.js";

import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
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

const app = express();
configureLogging(`hab-api-${API_VERSION}`);
installProcessHandlers({ logger, flush: flushLogging });
app.use(opsHttpMiddleware);

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
  logger.error("Express request failed", {
    error: err,
    attributes: {
      component: "express",
      operation: "request",
      outcome: "failure",
    },
  });

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

// STARTUP
let server;

async function bootstrap() {
  if (!mongodbUri) {
    throw new Error("MongoDB configuration is missing");
  }

  await mongoose.connect(mongodbUri);
  logger.info("MongoDB connected", {
    attributes: {
      component: "database",
      dependency: "mongodb",
      outcome: "success",
    },
  });

  await initializeAnonymizedUser();

  server = app.listen(port, () => {
    logger.info("API ready", {
      attributes: {
        component: "express",
        operation: "startup",
        outcome: "success",
      },
    });
    if (process.send) process.send("ready");
  });

  initMessManagerWs(server);
  initGalaManagerWs(server);
  initScanBroadcast();
  initDelegatedGraphRedis();
}

bootstrap().catch((err) => {
  logger.fatal("API startup failed", {
    error: err,
    attributes: {
      component: "application",
      operation: "startup",
      outcome: "failure",
    },
  });
  void flushLogging().finally(() => process.exit(1));
});

// SHUTDOWN
let shuttingDown = false;
async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("API shutdown started", {
    attributes: {
      component: "application",
      operation: "shutdown",
      outcome: "started",
    },
  });

  // Stop accepting new HTTP connections
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    logger.info("HTTP server closed", {
      attributes: {
        component: "express",
        operation: "shutdown",
        outcome: "success",
      },
    });
  }

  // Close Mongoose connection
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed", {
      attributes: {
        component: "database",
        dependency: "mongodb",
        outcome: "success",
      },
    });
  } catch (err) {
    logger.error("MongoDB shutdown failed", {
      error: err,
      attributes: {
        component: "database",
        dependency: "mongodb",
        operation: "shutdown",
        outcome: "failure",
      },
    });
  }

  await flushLogging();
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export default app;
