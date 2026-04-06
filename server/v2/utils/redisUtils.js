const redisClient = require('./redisClient.js');

/**
 * Safely deletes all Redis keys matching a specific pattern using SCAN.
 * @param {string} pattern - The wildcard pattern to match (e.g., 'hostel_by_id_123*')
 */
const clearCacheByPattern = async (pattern) => {
  try {
    const client = redisClient.getInstance();
    if (!redisClient.getIsConnected() || !client) return;
    
    let cursor = '0';
    do {
      // Scan in batches of 100 to prevent blocking the Redis event loop
      // ioredis scan returns [cursor, elements_array]
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      
      if (keys.length > 0) {
        // Delete the batch of matched keys
        await client.del(...keys);
      }
    } while (cursor !== '0');
    
  } catch (err) {
    console.error(`Failed to clear cache for pattern ${pattern}:`, err);
  }
};

module.exports = {
  clearCacheByPattern,
};