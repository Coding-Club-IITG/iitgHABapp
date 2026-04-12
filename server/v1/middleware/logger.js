// Middleware for logging HTTP requests and responses using Winston and Express-Winston
import redis from "redis";
import { redisUrl } from "../config/default.js";

const client = redis.createClient({ url: redisUrl });
client.on("error", (err) => console.error("Redis Client Error", err));
client.connect();

const storeLogs = async (logInfo) => {
  try {
    // node-redis v4 uses camelCase for commands (lPush)
    await client.lPush("logs_queue", JSON.stringify(logInfo));
  } catch (err) {
    console.error("Error storing logs in Redis:", err);
  }
};

export default storeLogs;
