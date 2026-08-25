import { createClient } from "redis";
import { parseLogEventV1 } from "@coding-club-iitg/ops-contract";

import { redisUrl } from "../config/default.js";

const LOGGING_ENABLED = process.env.OPS_LOGGING_ENABLED === "true";
const LOG_STREAM_KEY = process.env.OPS_LOG_STREAM_KEY || "ops:logs:v1";

let telemetryRedis;
let connectPromise;

function getTelemetryRedis() {
  if (!telemetryRedis) {
    telemetryRedis = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: false,
      },
    });
    telemetryRedis.on("error", () => {
      // Telemetry must not expose connection details or crash a request
    });
  }
  return telemetryRedis;
}

async function ensureConnected() {
  const client = getTelemetryRedis();
  if (client.isReady) return client;

  connectPromise ??= client
    .connect()
    .then(() => undefined)
    .finally(() => {
      connectPromise = undefined;
    });
  await connectPromise;
  return client;
}

export async function publishLogEvent(input) {
  try {
    const event = parseLogEventV1(input);
    if (!LOGGING_ENABLED) return;
    const client = await ensureConnected();
    await client.xAdd(LOG_STREAM_KEY, "*", { event: JSON.stringify(event) });
  } catch {
    // Ops ingestion is best-effort and cannot change API or worker behavior
  }
}

export async function closeOpsTelemetry() {
  if (telemetryRedis?.isOpen) await telemetryRedis.close();
  telemetryRedis = undefined;
  connectPromise = undefined;
}
