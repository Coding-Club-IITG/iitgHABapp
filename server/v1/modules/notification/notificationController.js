import { Hostel } from "../hostel/hostelModel.js";
import Alert from "./notificationModel.js";
import redisClient from "../../utils/redisClient.js";
import admin from "./firebase.js";
import FCMToken from "./FCMToken.js";

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

// Register (or update) FCM token for a user
export const registerToken = async (req, res) => {
  try {
    if (!req.user)
      return res.status(403).json({ error: "Only users can register tokens" });

    const { fcmToken } = req.body;
    if (!fcmToken)
      return res.status(400).json({ error: "FCM token is required" });

    // Always subscribe to general notifications (available to all authenticated users)
    admin.messaging().subscribeToTopic(fcmToken, "All_Hostels");

    // Hostel/mess-specific subscriptions require Microsoft linking
    if (req.user.hasMicrosoftLinked && req.user.rollNumber) {
      try {
        const curr_sub_mess = req.user.curr_subscribed_mess;
        if (curr_sub_mess) {
          const curr_sub_mess_name = (
            await Hostel.findById(curr_sub_mess._id || curr_sub_mess)
          )["hostel_name"].replaceAll(" ", "_");

          // Get user's current hostel name for Boarders_Their_Hostel topic
          const userHostel = await Hostel.findById(req.user.hostel);
          const userHostelName = userHostel
            ? userHostel.hostel_name.replaceAll(" ", "_")
            : null;

          console.log("Subscribing to topics:", {
            curr_sub_mess_name,
            userHostelName,
          });

          // Subscribe based on user's CURRENT HOSTEL (where they live)
          if (userHostelName) {
            // For boarders of this hostel
            admin
              .messaging()
              .subscribeToTopic(fcmToken, `Boarders_${userHostelName}`);
          }

          // Subscribe based on user's SUBSCRIBED MESS (hostel where their mess is)
          admin
            .messaging()
            .subscribeToTopic(fcmToken, `Subscribers_${curr_sub_mess_name}`);

          // Legacy: Subscribe to the hostel name directly (for backward compatibility)
          admin.messaging().subscribeToTopic(fcmToken, curr_sub_mess_name);
        }
      } catch (err) {
        console.error("Error subscribing to hostel/mess topics:", err);
        // Continue even if subscription fails
      }
    }

    await FCMToken.findOneAndUpdate(
      { user: req.user._id },
      { token: fcmToken },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ message: "FCM token registered" });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

// Generalized broadcast function
export async function sendNotificationMessage(
  title,
  body,
  topic,
  data = {},
  isAlert = false,
  channelId = "hab_general_alerts",
) {
  const payloadData = { ...data };

  if (isAlert) {
    payloadData.alert = "true";
    payloadData.title = title;
    payloadData.body = body;
  }

  // Use Mixed Payload: 'notification' makes the phone buzz, 'data' drives the Flutter UI
  const message = {
    notification: { title, body },
    data: payloadData,
    topic: topic,
    android: {
      notification: {
        channelId: channelId, // Connects to OS settings
      },
    },
  };

  console.log("Broadcasting message:", message);
  await admin.messaging().send(message);
}

// Send a notification directly to a specific user's FCM token
// Added channelId parameter for granular control
export const sendNotificationToUser = async (
  userId,
  title,
  body,
  channelId = "hab_general_alerts",
) => {
  try {
    const tokenDoc = await FCMToken.findOne({ user: userId });
    if (!tokenDoc || !tokenDoc.token) return;

    const message = {
      token: tokenDoc.token,
      notification: { title, body },
      android: {
        notification: {
          channelId: channelId, // Connects to OS settings
        },
      },
    };

    await admin.messaging().send(message);
  } catch (e) {
    console.error("Error sending user notification:", e);
  }
};

// Send multicast notification to all userIds
export const sendNotificationToMultipleUsers = async (
  userIds,
  title,
  body,
  channelId = "hab_general_alerts",
) => {
  try {
    const tokens = await FCMToken.find({ user: { $in: userIds } }).select(
      "token",
    );
    const tokenArray = tokens.map((t) => t.token);

    if (tokenArray.length === 0) return null;

    const response = await admin.messaging().sendMulticast({
      tokens: tokenArray,
      notification: { title, body },
      android: {
        notification: {
          channelId: channelId,
        },
      },
    });

    console.log(
      `Sent multicast notification to ${response.successCount} users`,
    );
    return response;
  } catch (error) {
    console.error("Error sending multicast notification:", error);
  }
};

// REST API Endpoint: Send notification to all users of a topic
export const sendNotification = async (req, res) => {
  try {
    // Admin can specify channelId via portal, or it defaults to general
    const { title, body, topic, isAlert, channelId } = req.body;
    await sendNotificationMessage(
      title,
      body,
      topic,
      {},
      isAlert || false,
      channelId || "hab_general_alerts",
    );
    res.status(200).json({ message: "Notification sent" });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

// Send welcome notification to the authenticated user
// Called from frontend after FCM token registration
export const sendWelcomeNotification = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(403).json({ error: "Authentication required" });
    }

    // Check if user already has FCM token registered
    const tokenDoc = await FCMToken.findOne({ user: req.user._id });
    if (!tokenDoc || !tokenDoc.token) {
      return res.status(400).json({
        error: "FCM token not registered yet. Please register token first.",
      });
    }

    // Send welcome notification (defaults to general channel)
    await sendNotificationToUser(
      req.user._id,
      "Welcome to HABit IITG",
      "Thanks for signing in to your go-to app for all your hostel and mess related updates.",
      "hab_general_alerts",
    );

    res.status(200).json({ message: "Welcome notification sent" });
  } catch (err) {
    console.error("Error sending welcome notification:", err);
    res.status(500).json({ error: "Failed to send welcome notification" });
  }
};

// Create urgent alert notification
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

      // Send Mixed Payload (Notification + Data)
      await sendNotificationMessage(
        title,
        body,
        fcmTopic,
        {
          id: newAlert._id.toString(),
          title,
          body,
          expiresAt: expiresAtMs.toString(),
          ttlSeconds: String(ttlSeconds),
          hasCountdown: hasCountdown ? "true" : "false",
          targetType,
        },
        true,
        nativeChannelId,
        ttlSeconds,
      );
    }

    res
      .status(201)
      .json({ message: "Alert created successfully", alert: newAlert });
  } catch (err) {
    console.error("Error creating alert:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Fetches relevant active alerts for the logged-in user
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
