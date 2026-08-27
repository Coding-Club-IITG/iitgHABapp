import { createOpsLogger } from "@coding-club-iitg/ops-logger";
import { createExpressOpsLogger } from "@coding-club-iitg/ops-logger/express";

const SERVICE = "hab-gateway";
const EXPORT_ALL_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const PLACEHOLDER_SECRET = /^(?:replace|change[-_ ]?me|your[_-])/i;

function configFromEnvironment() {
  const flag = process.env.OPS_LOGGING_ENABLED;
  if (flag !== "true" && flag !== "false") {
    throw new Error("OPS_LOGGING_ENABLED must be explicitly true or false");
  }

  const enabled = flag === "true";
  const ingestionUrl =
    process.env.OPS_LOG_INGEST_URL || "http://localhost:3005/api/ingest/logs";
  const secret = process.env.OPS_LOG_INGEST_SECRET || "disabled-local-logger";
  let parsed;
  try {
    parsed = new URL(ingestionUrl);
  } catch {
    throw new Error("OPS_LOG_INGEST_URL must be an absolute HTTP(S) URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("OPS_LOG_INGEST_URL must be an absolute HTTP(S) URL");
  }
  if (enabled && process.env.NODE_ENV === "production") {
    if (parsed.protocol !== "https:") {
      throw new Error("Production Ops logging requires HTTPS");
    }
    if (secret.length < 32 || PLACEHOLDER_SECRET.test(secret)) {
      throw new Error("Production Ops logging requires a non-placeholder 32-character secret");
    }
  }
  return { project: "habit", service: SERVICE, ingestionUrl, secret, enabled };
}

const config = configFromEnvironment();
const httpAdapter = createExpressOpsLogger({
  ...config,
  exportLevels: EXPORT_ALL_LEVELS,
});
const applicationLogger = createOpsLogger({
  ...config,
  getCorrelationId: httpAdapter.getCorrelationId,
});

function normalizeDetails(values) {
  const supplied = values[0];
  if (
    supplied &&
    typeof supplied === "object" &&
    !(supplied instanceof Error) &&
    ("error" in supplied || "attributes" in supplied || "correlationId" in supplied)
  ) {
    return supplied;
  }
  const error = values.find((value) => value instanceof Error);
  return error ? { error } : undefined;
}

export const logger = Object.freeze({
  debug: (message, ...values) =>
    applicationLogger.debug(message, normalizeDetails(values)),
  info: (message, ...values) =>
    applicationLogger.info(message, normalizeDetails(values)),
  warn: (message, ...values) =>
    applicationLogger.warn(message, normalizeDetails(values)),
  error: (message, ...values) =>
    applicationLogger.error(message, normalizeDetails(values)),
  fatal: (message, ...values) =>
    applicationLogger.fatal(message, normalizeDetails(values)),
});
export const opsHttpMiddleware = httpAdapter.middleware;

export async function flushLogging() {
  await Promise.allSettled([applicationLogger.flush(), httpAdapter.logger.flush()]);
}
