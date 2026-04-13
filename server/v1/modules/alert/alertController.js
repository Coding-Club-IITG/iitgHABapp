import { Hostel } from "../hostel/hostelModel.js";
import Alert from "./alertModel.js";
import admin from "../notification/firebase.js";
import redisClient from "../../utils/redisClient.js";

// Helper to determine Redis Key based on target type and ID
const getRedisKey = (type, id) => `alerts:${type}${id ? ":" + id : ":all"}`;

// Human-readable time left for notification body
function formatTimeRemainingSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * POST /alerts/create
 * Creates an alert, saves to DB, caches in Redis, and fires FCM Push
 */
export const createAlert = async (req, res) => {
  try {
    const { title, body, ttlSeconds, targetType, targetIds, hasCountdown } =
      req.body;

    if (!title || !body || !ttlSeconds || !targetType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const expiresAtMs = expiresAt.getTime();

    // 1. Persist to Database
    const newAlert = new Alert({
      title,
      body,
      hasCountdown,
      expiresAt,
      targetType,
      targetIds: targetType === "global" ? [] : targetIds,
      createdBy: req.user ? req.user._id : null,
    });
    await newAlert.save();

    const alertData = JSON.stringify({
      id: newAlert._id.toString(),
      title,
      body,
      hasCountdown: hasCountdown ? "true" : "false",
      expiresAt: expiresAtMs.toString(),
      targetType,
    });

    // 2. Cache in Redis (using Sorted Sets for multiple alerts) & Fire FCM
    const targets = targetType === "global" ? ["all"] : targetIds;

    for (const targetId of targets) {
      // Add to Redis ZSET. Score = expiresAt, Member = alert JSON string
      const redisKey = getRedisKey(
        targetType,
        targetType === "global" ? null : targetId,
      );
      await redisClient.zadd(redisKey, expiresAtMs, alertData);

      // Cleanup old expired alerts from this specific ZSET asynchronously
      redisClient
        .zremrangebyscore(redisKey, 0, Date.now())
        .catch(console.error);

      // 3. Resolve FCM Topic mapping based on existing system standards
      let fcmTopic = "All_Hostels";
      if (targetType !== "global") {
        const hostelDoc = await Hostel.findById(targetId);
        if (hostelDoc) {
          const formattedName = hostelDoc.hostel_name.replaceAll(" ", "_");
          fcmTopic =
            targetType === "hostel"
              ? `Boarders_${formattedName}`
              : `Subscribers_${formattedName}`;
        }
      }

      // 4. Send Mixed Payload (Notification + Data)
      // Resolving the correct Android Native Channel ID
      let nativeChannelId = "hab_general_alerts";
      if (targetType === "mess") nativeChannelId = "hab_mess_updates";
      if (targetType === "feedback") nativeChannelId = "hab_feedback_reminders";

      // System tray text: include timer line when countdown is enabled
      const notificationBody =
        hasCountdown === true
          ? `${body}\n\n⏱ ${formatTimeRemainingSeconds(ttlSeconds)}`
          : body;

      // Send Data-Only Message (Architecture PDF Requirement 7)
      await admin.messaging().send({
        notification: {
          title: title,
          body: notificationBody,
        },
        data: {
          id: newAlert._id.toString(),
          title,
          body,
          expiresAt: expiresAtMs.toString(),
          ttlSeconds: String(ttlSeconds),
          hasCountdown: hasCountdown ? "true" : "false",
          alert: "true",
          isAlert: "true",
          targetType,
        },
        topic: fcmTopic,
        android: {
          ttl: ttlSeconds * 1000,
          notification: {
            channelId: nativeChannelId, // This links to the Android OS settings!
          },
        },
      });
    }

    res
      .status(201)
      .json({ message: "Alert created successfully", alert: newAlert });
  } catch (err) {
    console.error("Error creating alert:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /alerts
 * Fetches relevant active alerts for the logged-in user
 */
export const getAlerts = async (req, res) => {
  try {
    const now = Date.now();
    const user = req.user;

    // Determine relevant targets for this user
    const targetKeys = [
      getRedisKey("global"),
      getRedisKey("hostel", user.hostel?.toString()),
      getRedisKey("mess", user.curr_subscribed_mess?.toString()),
    ].filter(Boolean);

    let allAlerts = [];

    // Fetch from Redis
    for (const key of targetKeys) {
      // O(log N) fetch of non-expired alerts
      const cachedAlerts = await redisClient.zrangebyscore(key, now, "+inf");

      if (cachedAlerts && cachedAlerts.length > 0) {
        allAlerts.push(...cachedAlerts.map((a) => JSON.parse(a)));
      } else {
        // Cache Miss or Empty: Fallback to DB (Architecture PDF Requirement 4.2.8)
        const targetType = key.split(":")[1];
        const targetId = key.split(":")[2];

        const query = { expiresAt: { $gt: new Date(now) }, targetType };
        if (targetType !== "global" && targetId) {
          query.targetIds = targetId;
        }

        const dbAlerts = await Alert.find(query).lean();
        if (dbAlerts.length > 0) {
          const parsedAlerts = dbAlerts.map((alert) => ({
            id: alert._id.toString(),
            title: alert.title,
            body: alert.body,
            hasCountdown: alert.hasCountdown ? "true" : "false",
            expiresAt: new Date(alert.expiresAt).getTime().toString(),
            targetType: alert.targetType,
          }));
          allAlerts.push(...parsedAlerts);

          // Re-hydrate cache
          for (const parsed of parsedAlerts) {
            await redisClient.zadd(
              key,
              Number(parsed.expiresAt),
              JSON.stringify(parsed),
            );
          }
        }
      }
    }

    // Sort by expiresAt (ascending - ending soonest first)
    allAlerts.sort((a, b) => Number(a.expiresAt) - Number(b.expiresAt));

    res.status(200).json({ alerts: allAlerts });
  } catch (err) {
    console.error("Error fetching alerts:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
