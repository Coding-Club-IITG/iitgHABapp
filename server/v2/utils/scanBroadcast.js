/**
 * Cross-instance broadcast for scan events (cluster-safe).
 *
 * When REDIS_URL is set: publishes to Redis; every api-v1 instance subscribes
 * and runs the local WebSocket broadcast. The instance that has the manager's
 * connection will deliver the message.
 *
 * When REDIS_URL is not set: calls the local broadcast only (single-instance behavior).
 */

const redisClient = require("./redisClient.js");

const REDIS_CHANNEL_MESS = "hab:mess:scan";
const REDIS_CHANNEL_GALA = "hab:gala:scan";

let redisSubscriber = null;
let redisDisabled = false;

function getLocalBroadcasts() {
  const {
    broadcastMessScanToManagers,
  } = require("../modules/mess/messManagerWs.js");
  const {
    broadcastGalaScanToManagers,
  } = require("../modules/gala/galaManagerWs.js");
  return { broadcastMessScanToManagers, broadcastGalaScanToManagers };
}

/**
 * Publish mess scan event. With Redis: all instances receive and broadcast locally.
 * Without Redis: only this process broadcasts.
 */
function publishMessScan(payload) {
  const { broadcastMessScanToManagers } = getLocalBroadcasts();
  const client = redisClient.getInstance();
  if (client && redisClient.getIsConnected()) {
    client.publish(REDIS_CHANNEL_MESS, JSON.stringify(payload)).catch((err) => {
      console.error("[scanBroadcast] Redis publish mess failed:", err);
      broadcastMessScanToManagers(payload);
    });
  } else {
    broadcastMessScanToManagers(payload);
  }
}

/**
 * Publish gala scan event. With Redis: all instances receive and broadcast locally.
 * Without Redis: only this process broadcasts.
 */
function publishGalaScan(payload) {
  const { broadcastGalaScanToManagers } = getLocalBroadcasts();
  const client = redisClient.getInstance();
  if (client && redisClient.getIsConnected()) {
    client.publish(REDIS_CHANNEL_GALA, JSON.stringify(payload)).catch((err) => {
      console.error("[scanBroadcast] Redis publish gala failed:", err);
      broadcastGalaScanToManagers(payload);
    });
  } else {
    broadcastGalaScanToManagers(payload);
  }
}

function disableRedis(reason) {
  redisDisabled = true;
  if (redisSubscriber) {
    try {
      redisSubscriber.disconnect();
    } catch (_) {}
    redisSubscriber = null;
  }
  console.warn(
    "[scanBroadcast] Redis subscriber unavailable:",
    reason,
    "- using direct broadcast (single-instance).",
  );
}

/**
 * Initialize Redis subscriber and subscribe to scan channels.
 * Call once after WebSocket servers are initialized (e.g. in index.js).
 * No-op if REDIS_URL is not set. If Redis connection fails, falls back to direct broadcast without spamming errors.
 */
function initScanBroadcast() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return;
  }

  try {
    const Redis = require("ioredis");
    const opts = {
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    };

    redisSubscriber = new Redis(redisUrl, opts);

    const onError = (err) => {
      if (redisDisabled) return;
      disableRedis(err?.message || err?.code || "connection failed");
    };

    redisSubscriber.on("error", onError);

    redisSubscriber.on("message", (channel, message) => {
      const { broadcastMessScanToManagers, broadcastGalaScanToManagers } =
        getLocalBroadcasts();
      try {
        const payload = JSON.parse(message);
        if (channel === REDIS_CHANNEL_MESS) {
          broadcastMessScanToManagers(payload);
        } else if (channel === REDIS_CHANNEL_GALA) {
          broadcastGalaScanToManagers(payload);
        }
      } catch (e) {
        console.error("[scanBroadcast] Invalid message:", e);
      }
    });

    redisSubscriber.once("ready", () => {
      if (redisDisabled || !redisSubscriber) return;
      redisSubscriber.subscribe(
        REDIS_CHANNEL_MESS,
        REDIS_CHANNEL_GALA,
        (err, count) => {
          if (redisDisabled) return;
          if (err) {
            disableRedis(err.message || "subscribe failed");
            return;
          }
          console.log(
            "[scanBroadcast] Subscribed to",
            REDIS_CHANNEL_MESS,
            REDIS_CHANNEL_GALA,
            "count:",
            count,
          );
        },
      );
    });
  } catch (e) {
    console.error("[scanBroadcast] Redis subscriber init failed:", e);
    redisSubscriber = null;
  }
}

module.exports = {
  publishMessScan,
  publishGalaScan,
  initScanBroadcast,
};
