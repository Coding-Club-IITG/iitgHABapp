// server/index.js (The Gateway)
require("dotenv").config();
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000; // The public port

// Configuration: Where your actual apps are running
const targets = {
  v1: "http://localhost:3001", 
  v2: "http://localhost:3002", 
};

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
      
      // Allow all origins for development (mobile apps, etc.)
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
  })
);

// 1. Logging Middleware (Optional: Helps debugging)
app.use((req, res, next) => {
  console.log(`[Gateway] Request: ${req.method} ${req.url}`);
  next();
});

// 2. Routing Logic
const selectProxyTarget = (req) => {
  // Check for Header: "x-api-version: v2"
  const headerVersion = req.headers["x-api-version"];
  
  if (headerVersion === "v2") {
    return targets.v2;
  }
  // Default to V1 for everyone else
  return targets.v1;
};

// 3. Proxy Setup - http-proxy-middleware automatically handles multipart/form-data streaming
const apiProxy = createProxyMiddleware({
  target: targets.v1, // fallback target
  changeOrigin: true,
  router: selectProxyTarget,
  ws: true, // Support websockets if needed
  logLevel: "debug", // detailed logs in console
  // All headers (including Authorization and Content-Type) are automatically preserved
  // Multipart/form-data is automatically streamed without buffering
});

// 4. Forward everything to the proxy (but don't parse body - proxy handles it)
app.use("/", apiProxy);

app.listen(PORT, () => {
  console.log(`🚀 Gateway running on PORT ${PORT}`);
  console.log(`   -> V1 (Legacy) upstream: ${targets.v1}`);
  console.log(`   -> V2 (New) upstream:    ${targets.v2}`);
});
