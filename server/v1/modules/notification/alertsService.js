import redisClient from "../../utils/redisClient.js";

import Alert from "./notificationModel.js";

const getRedisKey = (type, id) => `alerts:${type}${id ? ":" + id : ":all"}`;

function toAlertDto(alert) {
  if (!alert) return null;
  return {
    id: alert._id ? alert._id.toString() : String(alert.id),
    title: alert.title,
    body: alert.body,
    hasCountdown: alert.hasCountdown ? "true" : "false",
    expiresAt: new Date(alert.expiresAt).getTime().toString(),
    targetType: alert.targetType,
  };
}

export async function getActiveAlertsForUser(user) {
  const now = Date.now();

  const targetKeys = [
    getRedisKey("global"),
    getRedisKey("hostel", user?.hostel?.toString()),
    getRedisKey("mess", user?.curr_subscribed_mess?.toString()),
  ].filter(Boolean);

  let allAlerts = [];

  for (const key of targetKeys) {
    const cachedAlerts = await redisClient.zrangebyscore(key, now, "+inf");
    if (cachedAlerts && cachedAlerts.length > 0) {
      allAlerts.push(...cachedAlerts.map((a) => JSON.parse(a)));
      continue;
    }

    const targetType = key.split(":")[1];
    const targetId = key.split(":")[2];

    const query = { expiresAt: { $gt: new Date(now) }, targetType };
    if (targetType !== "global" && targetId) {
      query.targetIds = targetId;
    }

    const dbAlerts = await Alert.find(query).lean();
    if (dbAlerts.length > 0) {
      const parsedAlerts = dbAlerts.map((a) => toAlertDto(a)).filter(Boolean);
      allAlerts.push(...parsedAlerts);

      for (const parsed of parsedAlerts) {
        await redisClient.zadd(
          key,
          Number(parsed.expiresAt),
          JSON.stringify(parsed),
        );
      }
    }
  }

  allAlerts = allAlerts
    .map((a) => {
      if (a && a.expiresAt && a.id) return a;
      return null;
    })
    .filter(Boolean);

  allAlerts.sort((a, b) => Number(a.expiresAt) - Number(b.expiresAt));
  return allAlerts;
}

