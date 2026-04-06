const Redis = require("ioredis");

let client = null;
let isConnected = false;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  client.on("error", (err) => {
    console.warn("[Redis] Client error:", err.message);
    isConnected = false;
  });

  client.on("ready", () => {
    console.log("[Redis] Client connected and ready");
    isConnected = true;
  });

  client.on("close", () => {
    isConnected = false;
  });
} else {
  console.warn("[Redis] REDIS_URL not provided. Redis caching is disabled.");
}

const redisClient = {
  get: async (key) => {
    if (isConnected && client) {
      try {
        return await client.get(key);
      } catch (err) {
        console.warn(`[Redis] GET error for ${key}:`, err.message);
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
        console.warn(`[Redis] SET error for ${key}:`, err.message);
      }
    }
  },
  del: async (key) => {
    if (isConnected && client) {
      try {
        await client.del(key);
      } catch (err) {
        console.warn(`[Redis] DEL error for ${key}:`, err.message);
      }
    }
  },
  getInstance: () => client,
  getIsConnected: () => isConnected,
};

module.exports = redisClient;
