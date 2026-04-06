const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const axios = require("axios");
const onedrive = require("../config/onedrive.js");
const redisClient = require("./redisClient.js");

const tokenFilePath =
  process.env.GRAPH_DELEGATED_TOKEN_PATH ||
  path.resolve(__dirname, "..", ".secrets", "graph_delegated_token.json");

const REDIS_KEY_TOKEN = "hab:graph:delegated_token";
const REDIS_KEY_LOCK = "hab:graph:delegated_refresh_lock";
const LOCK_TTL_SEC = 25;
const VALIDITY_BUFFER_MS = 60_000; // consider valid until expires_at - 1 min

let inMemory = {
  access_token: null,
  refresh_token: null,
  expires_at: 0, // epoch ms
};

let redisDisabled = false;

function getRedisClient() {
  if (redisDisabled) return null;
  const client = redisClient.getInstance();
  if (client && redisClient.getIsConnected()) {
    return client;
  }
  return null;
}

function tokenEndpoint() {
  const tenant = onedrive.authTenant || onedrive.tenantId || "common";
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

async function ensureDir() {
  await fsp.mkdir(path.dirname(tokenFilePath), { recursive: true });
}

function isTokenValid(obj) {
  if (!obj || !obj.access_token || !obj.expires_at) return false;
  const now = Date.now();
  return now < Number(obj.expires_at) - VALIDITY_BUFFER_MS;
}

async function loadFromDisk() {
  try {
    const raw = await fsp.readFile(tokenFilePath, "utf8");
    const json = JSON.parse(raw);
    if (json.access_token && json.refresh_token && json.expires_at) {
      inMemory = json;
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function saveToDisk() {
  await ensureDir();
  await fsp.writeFile(tokenFilePath, JSON.stringify(inMemory, null, 2), "utf8");
  console.log(
    `[Graph Delegated] Saved token to ${tokenFilePath}. Expires at: ${new Date(
      inMemory.expires_at,
    ).toISOString()}`,
  );
}

/** Write current inMemory token to Redis so other instances see it. */
async function saveToRedis() {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const ttl = Math.max(1, Math.floor((inMemory.expires_at - Date.now()) / 1000));
    await redis.set(
      REDIS_KEY_TOKEN,
      JSON.stringify({
        access_token: inMemory.access_token,
        refresh_token: inMemory.refresh_token,
        expires_at: inMemory.expires_at,
      }),
      "EX",
      ttl
    );
  } catch (e) {
    console.warn("[Graph Delegated] Redis write failed:", e?.message);
  }
}

/** Try to get token from Redis. Returns token object or null. */
async function loadFromRedis() {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(REDIS_KEY_TOKEN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/** Try to acquire refresh lock. Returns true if we got it. */
async function acquireRefreshLock() {
  const redis = getRedisClient();
  if (!redis) return true; // no Redis => single instance, no lock needed
  try {
    const ok = await redis.set(REDIS_KEY_LOCK, "1", "EX", LOCK_TTL_SEC, "NX");
    return ok === "OK";
  } catch (e) {
    return false;
  }
}

function hasValidToken() {
  const now = Date.now();
  return (
    Boolean(inMemory.access_token) &&
    now < Number(inMemory.expires_at) - VALIDITY_BUFFER_MS
  );
}

async function doRefresh() {
  if (!inMemory.refresh_token) {
    throw new Error(
      "No refresh_token available. Start delegated OAuth and save tokens.",
    );
  }
  if (!onedrive.clientId) throw new Error("CLIENT_ID missing");

  const params = new URLSearchParams();
  params.append("client_id", onedrive.clientId);
  if (onedrive.clientSecret) {
    params.append("client_secret", onedrive.clientSecret);
  }
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", inMemory.refresh_token);
  const scopes =
    Array.isArray(onedrive.graphUserScopes) && onedrive.graphUserScopes.length
      ? onedrive.graphUserScopes.join(" ")
      : "offline_access User.Read";
  params.append("scope", scopes);

  console.log("[Graph Delegated] Refreshing access token...");
  const resp = await axios.post(tokenEndpoint(), params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: (s) => s < 500,
  });
  const data = resp.data || {};
  if (!data.access_token) {
    const hint = `Grant delegated consent for scopes [${scopes}] to app ${onedrive.clientId} and re-authenticate via /api/_debug/graph/start`;
    throw new Error(
      `Failed to refresh delegated token: ${data.error || "unknown_error"} ${
        data.error_description || ""
      }. ${hint}`,
    );
  }
  const expiresInSec = Number(data.expires_in || 3600);
  inMemory.access_token = data.access_token;
  inMemory.refresh_token = data.refresh_token || inMemory.refresh_token;
  inMemory.expires_at = Date.now() + expiresInSec * 1000;

  console.log(
    `[Graph Delegated] New access token acquired. Expires at: ${new Date(
      inMemory.expires_at,
    ).toISOString()}`,
  );
  await saveToDisk();
  await saveToRedis();
  return inMemory.access_token;
}

async function refreshIfNeeded() {
  const redis = getRedisClient();

  if (redis) {
    // Cluster path: use Redis as source of truth
    let tokenObj = await loadFromRedis();
    if (isTokenValid(tokenObj)) {
      inMemory = tokenObj;
      return tokenObj.access_token;
    }
    // Redis miss or expired: load from file so we have refresh_token, then re-check Redis
    await loadFromDisk();
    tokenObj = await loadFromRedis();
    if (isTokenValid(tokenObj)) {
      inMemory = tokenObj;
      return tokenObj.access_token;
    }
    if (hasValidToken()) {
      await saveToRedis();
      return inMemory.access_token;
    }
    // Need refresh: only one process should do it
    const gotLock = await acquireRefreshLock();
    if (gotLock) {
      if (!inMemory.refresh_token) await loadFromDisk();
      if (hasValidToken()) return inMemory.access_token;
      return doRefresh();
    }
    // Another process is refreshing: wait and re-read from Redis
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 800));
      tokenObj = await loadFromRedis();
      if (isTokenValid(tokenObj)) {
        inMemory = tokenObj;
        return tokenObj.access_token;
      }
    }
    // Fallback: try refresh without lock (last resort)
    if (!inMemory.refresh_token) await loadFromDisk();
    return doRefresh();
  }

  // No Redis: original single-instance behavior
  if (hasValidToken()) return inMemory.access_token;
  if (!hasValidToken()) {
    await loadFromDisk();
    if (hasValidToken()) return inMemory.access_token;
  }
  return doRefresh();
}

async function getDelegatedAccessToken() {
  return refreshIfNeeded();
}

async function setDelegatedTokens({ access_token, refresh_token, expires_at }) {
  if (!access_token || !refresh_token || !expires_at) {
    throw new Error(
      "setDelegatedTokens requires access_token, refresh_token, expires_at (epoch ms).",
    );
  }
  inMemory = {
    access_token,
    refresh_token,
    expires_at: Number(expires_at),
  };
  await saveToDisk();
  await saveToRedis();
}

/** Call at worker startup so Redis client connects and backfills from disk early. */
function initDelegatedGraphRedis() {
  loadFromDisk().then(() => {
    if (hasValidToken()) saveToRedis();
  });
}

module.exports = {
  getDelegatedAccessToken,
  setDelegatedTokens,
  tokenFilePath,
  initDelegatedGraphRedis,
};
