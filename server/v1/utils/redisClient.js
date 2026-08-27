import { logger } from "../logging/logger.js";
import Redis from "ioredis";
import { redisUrl, REDIS_KEY_PREFIX } from "../config/default.js";

let client = null;
let isConnected = false;

if (redisUrl) {
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    keyPrefix: REDIS_KEY_PREFIX,
  });

  client.on("error", (err) => {
    logger.warn("[Redis] Client error:", err.message);
    isConnected = false;
  });

  client.on("ready", () => {
    logger.info("[Redis] Client connected and ready");
    isConnected = true;
  });

  client.on("close", () => {
    isConnected = false;
  });
} else {
  logger.info("Redis caching is disabled");
}

const redisClient = {
  get: async (key) => {
    if (isConnected && client) {
      try {
        return await client.get(key);
      } catch (err) {
        logger.warn("Redis GET failed", { error: err });
        return null;
      }
    }
    return null;
  },
  set: async (key, value, mode, duration) => {
    if (isConnected && client) {
      try {
        if (mode && duration) {
          await client.set(key, value, mode, duration);
        } else {
          await client.set(key, value);
        }
      } catch (err) {
        logger.warn("Redis SET failed", { error: err });
      }
    }
  },
  del: async (key) => {
    if (isConnected && client) {
      try {
        await client.del(key);
      } catch (err) {
        logger.warn("Redis DELETE failed", { error: err });
      }
    }
  },

  // Added Sorted Set Methods for Alerts Feature
  zadd: async (key, score, member) => {
    if (isConnected && client) {
      try {
        return await client.zadd(key, score, member);
      } catch (err) {
        logger.warn("Redis sorted-set write failed", { error: err });
        return null;
      }
    }
    return null;
  },
  zrangebyscore: async (key, min, max) => {
    if (isConnected && client) {
      try {
        return await client.zrangebyscore(key, min, max);
      } catch (err) {
        logger.warn("Redis sorted-set read failed", { error: err });
        return [];
      }
    }
    return []; // Return empty array on fail/disconnect so getAlerts doesn't crash
  },
  zremrangebyscore: async (key, min, max) => {
    if (isConnected && client) {
      try {
        return await client.zremrangebyscore(key, min, max);
      } catch (err) {
        logger.warn("Redis sorted-set cleanup failed", { error: err });
        return null;
      }
    }
    return null;
  },

  getInstance: () => client,
  getIsConnected: () => isConnected,
};

export default redisClient;
