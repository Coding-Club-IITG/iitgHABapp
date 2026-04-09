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
  
  // Added Sorted Set Methods for Alerts Feature
  zadd: async (key, score, member) => {
    if (isConnected && client) {
      try {
        return await client.zadd(key, score, member);
      } catch (err) {
        console.warn(`[Redis] ZADD error for ${key}:`, err.message);
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
        console.warn(`[Redis] ZRANGEBYSCORE error for ${key}:`, err.message);
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
        console.warn(`[Redis] ZREMRANGEBYSCORE error for ${key}:`, err.message);
        return null;
      }
    }
    return null;
  },

  getInstance: () => client,
  getIsConnected: () => isConnected,
};

module.exports = redisClient;
