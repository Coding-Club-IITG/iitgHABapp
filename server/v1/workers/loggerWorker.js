import { Pool } from "pg";
import Redis from "ioredis";
import { redisUrl, postgresUrl, REDIS_KEY_PREFIX } from "../config/default.js";

const LOGS_QUEUE_KEY = `${REDIS_KEY_PREFIX}logs_queue`;

/* Redis */

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

redis.on("error", (err) =>
  console.error("[Logger Worker] Redis error:", err.message),
);

redis.on("ready", () => console.log("[Logger Worker] Redis connected"));

await redis.connect().catch((err) => {
  console.error("[Logger Worker] Redis connection failed:", err.message);
});

/* Postgres */

const pool = new Pool({
  connectionString: postgresUrl,
});

const BATCH = 20;

async function flush() {
  try {
    const len = await redis.lLen(LOGS_QUEUE_KEY);
    if (len < BATCH) return;

    /* Atomic read + remove */
    const tx = redis.multi();
    tx.lRange(LOGS_QUEUE_KEY, -BATCH, -1);
    tx.lTrim(LOGS_QUEUE_KEY, 0, -BATCH - 1);

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

    console.log("[Logger Worker] Inserted", parsed.length);
  } catch (error) {
    // Prevents the worker from crashing and restarting in PM2 if an insert fails
    console.log("[Logger Worker] Error during flush:", error.message || error);
  }
}
