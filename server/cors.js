// Origins allowed to make credentialed browser requests to the gateway.
// Keep in sync with the cors() origin lists in v1/index.js and v2/index.js.
export const allowedOrigins = new Set([
  "https://hab.codingclub.in",
  "https://hostel.codingclub.in",
  "https://smc.codingclub.in",
  "http://localhost:5172",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
]);

export function corsOriginCheck(origin, callback) {
  // Allow requests with no origin (mobile apps, Postman, server-to-server)
  if (!origin) return callback(null, true);
  // Unknown origins get no CORS headers, so the browser blocks the response
  callback(null, allowedOrigins.has(origin));
}
