import dotenv from "dotenv";
dotenv.config();

import installProcessHandlers from "./processHandlers.js";
installProcessHandlers();

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

const isAuthRedirectPath = (url = "") =>
  url.startsWith("/api/auth/login/redirect/mobile") ||
  url.startsWith("/api/auth/login/redirect/web");

// CORS middleware - must be before proxy
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
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

// 1. Logging Middleware (Optional: Helps debugging)
app.use((req, res, next) => {
  const rid =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    req.headers["x-amzn-trace-id"] ||
    "no-rid";

  // Keep logs high-signal: always log auth redirect callbacks (they're critical to debug),
  // otherwise keep the existing concise one-liner.
  if (isAuthRedirectPath(req.url)) {
    console.log("[Gateway][AuthRedirect][request]", {
      rid,
      method: req.method,
      url: req.url,
      hasCode: typeof req.query?.code === "string" && req.query.code.length > 0,
      state:
        typeof req.query?.state === "string"
          ? String(req.query.state)
          : undefined,
      xApiVersion: req.headers["x-api-version"],
      userAgent: req.headers["user-agent"],
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    });
  } else {
    console.log(`[Gateway] Request: ${req.method} ${req.url}`);
  }
  next();
});

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

// 3. Proxy Setup - http-proxy-middleware automatically handles multipart/form-data streaming
const apiProxy = createProxyMiddleware({
  target: targets.v1, // fallback target
  changeOrigin: true,
  router: selectProxyTarget,
  ws: true, // Support websockets if needed
  logLevel: "debug", // detailed logs in console
  onProxyReq: (proxyReq, req, res) => {
    if (!isAuthRedirectPath(req.url)) return;
    const rid =
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"] ||
      req.headers["x-amzn-trace-id"] ||
      "no-rid";
    const target = selectProxyTarget(req);
    console.log("[Gateway][AuthRedirect][proxyReq]", {
      rid,
      target,
      method: req.method,
      url: req.url,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    if (!isAuthRedirectPath(req.url)) return;
    const rid =
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"] ||
      req.headers["x-amzn-trace-id"] ||
      "no-rid";
    const target = selectProxyTarget(req);
    console.log("[Gateway][AuthRedirect][proxyRes]", {
      rid,
      target,
      statusCode: proxyRes.statusCode,
      location: proxyRes.headers?.location,
    });
  },
  onError: (err, req, res) => {
    const rid =
      req.headers?.["x-request-id"] ||
      req.headers?.["x-correlation-id"] ||
      req.headers?.["x-amzn-trace-id"] ||
      "no-rid";
    const target = (() => {
      try {
        return selectProxyTarget(req);
      } catch {
        return "unknown";
      }
    })();
    console.error("[Gateway][proxyError]", {
      rid,
      target,
      method: req.method,
      url: req.url,
      message: err?.message,
      code: err?.code,
    });
  },
  // All headers (including Authorization and Content-Type) are automatically preserved
  // Multipart/form-data is automatically streamed without buffering
});

// 4. Forward everything to the proxy (but don't parse body - proxy handles it)
app.use("/", apiProxy);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[GATEWAY] Running on PORT ${PORT} (0.0.0.0)`);
  console.log(`   -> v1 upstream: ${targets.v1}`);
  console.log(`   -> v2 upstream: ${targets.v2}`);
});
