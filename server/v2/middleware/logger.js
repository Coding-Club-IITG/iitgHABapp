// Middleware for logging HTTP requests and responses using Winston and Express-Winston
import redis from "redis";
import { redisUrl, REDIS_KEY_PREFIX } from "../config/default.js";

export const LOGS_QUEUE_KEY = `${REDIS_KEY_PREFIX}logs_queue`;

const client = redis.createClient({ url: redisUrl });
client.on("error", (err) => console.error("[Logger Redis] Error:", err));
client.connect();

const storeLogs = async (logInfo) => {
  try {
    await client.lPush(LOGS_QUEUE_KEY, JSON.stringify(logInfo));
  } catch (err) {
    console.error("[Logger Redis] Error storing log:", err);
  }
};

export default storeLogs;
