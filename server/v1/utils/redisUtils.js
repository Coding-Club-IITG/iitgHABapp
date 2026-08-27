import { logger } from "../logging/logger.js";
import redisClient from "./redisClient.js";
import { REDIS_KEY_PREFIX } from "../config/default.js";

/**
 * Safely deletes all Redis keys matching a specific pattern using SCAN.
 * @param {string} pattern - The wildcard pattern to match (e.g., 'hostel_by_id_123*')
 */
export const clearCacheByPattern = async (pattern) => {
  try {
    const client = redisClient.getInstance();
    if (!redisClient.getIsConnected() || !client) return;

    // Add version prefix
    const scopedPattern = `${REDIS_KEY_PREFIX}${pattern}`;

    let cursor = "0";
    do {
      // Scan in batches of 100 to prevent blocking the Redis event loop
      // ioredis scan returns [cursor, elements_array]
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        scopedPattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Delete the batch of matched keys
        // Strip prefix because client.del will add it back due to keyPrefix option
        const strippedKeys = keys.map(k => k.startsWith(REDIS_KEY_PREFIX) ? k.slice(REDIS_KEY_PREFIX.length) : k);
        await client.del(...strippedKeys);
      }
    } while (cursor !== "0");
  } catch (err) {
    logger.error("Redis cache clear failed", { error: err });
  }
};
