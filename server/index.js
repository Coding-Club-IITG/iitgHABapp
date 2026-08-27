import "dotenv/config";

import installProcessHandlers from "./processHandlers.js";
import { flushLogging, logger, opsHttpMiddleware } from "./logging/logger.js";
installProcessHandlers({ logger, flush: flushLogging });

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";
import {
  appVersionRouter,
  hqAppVersionRouter,
  rcAppVersionRouter,
} from "./modules/app_version/appVersionRoute.js";

const app = express();
const PORT = process.env.PORT || 3000;

const targets = {
  v1: `http://localhost:${process.env.PORT_V1 || 3001}`,
  v2: `http://localhost:${process.env.PORT_V2 || 3002}`,
};

// CORS middleware - must be before proxy
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "https://hab.codingclub.in",
        "https://hostel.codingclub.in",
        "https://smc.codingclub.in",
        "http://localhost:5172",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
      ];

      // Allow all origins for development
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-version",
      "X-Requested-With",
    ],
  }),
);

app.use(opsHttpMiddleware);

// 2. Routing Logic
const selectProxyTarget = (req) => {
  // Check for Header: "x-api-version: v2"
  const headerVersion = req.headers["x-api-version"];

  if (headerVersion === "v2") {
    return targets.v2;
  }
  // Default to v1 for everyone else
  return targets.v1;
};

// 2.5. Centralized App Version Routes (Before Proxy)
app.use("/api/app-version", appVersionRouter);
app.use("/api/hq-app-version", hqAppVersionRouter);
app.use("/api/rc-app-version", rcAppVersionRouter);

// 3. Proxy Setup
const apiProxy = createProxyMiddleware({
  target: targets.v1, // fallback target
  changeOrigin: true,
  router: selectProxyTarget,
  ws: true, // Support websockets if needed
  onError: (err, req, res) => {
    logger.error("Gateway proxy request failed", {
      error: err,
      attributes: {
        component: "proxy",
        dependency:
          selectProxyTarget(req) === targets.v2 ? "hab-api-v2" : "hab-api-v1",
        operation: "forward",
        outcome: "failure",
        retryable: true,
      },
    });
  },
  // All headers (including Authorization and Content-Type) are automatically preserved
  // Multipart/form-data is automatically streamed without buffering
});

// 4. Forward everything to the proxy
app.use("/", apiProxy);

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info("Gateway ready", {
    attributes: {
      component: "gateway",
      operation: "startup",
      outcome: "success",
    },
  });
});

let shuttingDown = false;
async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Gateway shutdown started", {
    attributes: {
      component: "gateway",
      operation: "shutdown",
      outcome: "started",
    },
  });
  await new Promise((resolve) => server.close(resolve));
  logger.info("Gateway stopped", {
    attributes: {
      component: "gateway",
      operation: "shutdown",
      outcome: "success",
    },
  });
  await flushLogging();
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
