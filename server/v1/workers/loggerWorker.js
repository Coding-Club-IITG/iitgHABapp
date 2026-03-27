const pg = require("pg");
const { createClient } = require("redis");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { Pool } = pg;

/* Redis */
// Ensure Redis is running and accessible. If in Docker, use -p 6379:6379
const redis = createClient({ url: process.env.REDIS_URL || "redis://127.0.0.1:6379" });

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
  connectionString: process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5433/postgres",
});

const BATCH = 20;

async function flush() {
  const len = await redis.lLen("logs_queue");
  if (len < BATCH) return;

  /* Atomic read + remove */
  const tx = redis.multi();
  tx.lRange("logs_queue", -BATCH, -1);
  tx.lTrim("logs_queue", 0, -BATCH - 1);

  const [logs] = await tx.exec();
  if (!logs.length) return;

  const parsed = logs.map(JSON.parse);

  /* Bulk insert */
  const values = parsed
    .map(
      (_, i) =>
        `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`
    )
    .join(",");

  const params = parsed.flatMap(l => {
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
      meta.userAgent || meta.req?.headers?.['user-agent'],
      { req: meta.req, res: meta.res }
    ];
  });

  await pool.query(
    `INSERT INTO server_logs(
      timestamp, level, message, method, url, status_code, response_time, correlation_id, ip_address, user_agent, meta
    ) VALUES ${values}`,
    params
  );

  console.log("Inserted", parsed.length);
}

/* Worker loop removed from global scope to init after connection */