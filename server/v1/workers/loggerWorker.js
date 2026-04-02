const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Ensure worker can find modules in the parent's node_modules directory
module.paths.push(path.resolve(__dirname, "../node_modules"));
const pg = require("pg");
const { Pool } = pg;

/* Redis */
const { createClient } = require("redis");
const redis = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

(async () => {
  try {
    await redis.connect();
    console.log("[Worker] Redis Connected");
    /* Worker loop - start only after connection */
    setInterval(flush, 1000);
  } catch (err) {
    console.error("[Worker] Redis Connection Error:", err);
  }
})();

/* Postgres */
const pool = new Pool({
  connectionString:
    process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@localhost:5433/postgres",
});

const BATCH = 20;

async function flush() {
  try {
    const len = await redis.lLen("logs_queue");
    if (len < BATCH) return;

    /* Atomic read + remove */
    const tx = redis.multi();
    tx.lRange("logs_queue", -BATCH, -1);
    tx.lTrim("logs_queue", 0, -BATCH - 1);

    const [logs] = await tx.exec();
    if (!logs.length) return;

    // FIX: Sanitize the raw string before parsing to remove both literal and escaped null bytes
    const parsed = logs.map((logStr) => {
      const safeStr = logStr.replace(/\x00/g, "").replace(/\\u0000/g, "");
      return JSON.parse(safeStr);
    });

    /* Bulk insert */
    const values = parsed
      .map(
        (_, i) =>
          `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`,
      )
      .join(",");

    const params = parsed.flatMap((l) => {
      const meta = l.meta || {};
      return [
        l.timestamp,
        l.level,
        l.message,
        meta.req?.method,
        meta.req?.url,
        meta.res?.statusCode,
        meta.responseTime,
        meta.correlationId,
        meta.ip,
        meta.userAgent || meta.req?.headers?.["user-agent"],
        { req: meta.req, res: meta.res },
      ];
    });

    await pool.query(
      `INSERT INTO server_logs(
          timestamp, level, message, method, url, status_code, response_time, correlation_id, ip_address, user_agent, meta
        ) VALUES ${values}`,
      params,
    );

    console.log("Inserted", parsed.length);
  } catch (error) {
    // Prevents the worker from crashing and restarting in PM2 if an insert fails
    console.error("[Worker] Error during flush:", error.message || error);
  }
}
