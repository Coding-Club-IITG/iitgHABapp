// Middleware for logging HTTP requests and responses using Winston and Express-Winston
const redis = require("redis");

const client = redis.createClient({ url: process.env.REDIS_URL });
client.on("error", (err) => console.error("Redis Client Error", err));
client.connect();

const storeLogs = async(logInfo) => {
  try {
    // node-redis v4 uses camelCase for commands (lPush)
    await client.lPush("logs_queue", JSON.stringify(logInfo));
  } catch (err) {
    console.error("Error storing logs in Redis:", err);
  }
}

module.exports = storeLogs;