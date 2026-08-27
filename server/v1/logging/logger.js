import { createOpsLogger } from "@coding-club-iitg/ops-logger";
import { createExpressOpsLogger } from "@coding-club-iitg/ops-logger/express";

const SERVICES = new Set([
  "hab-api-v1",
  "hab-api-v2",
  "hab-worker-agenda-v1",
]);
const EXPORT_ALL_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const PLACEHOLDER_SECRET = /^(?:replace|change[-_ ]?me|your[_-])/i;

function writeFallback(level) {
  try {
    const line = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "habit-unconfigured",
      level,
      message: "Log emitted before HAB logger configuration",
    })}\n`;
    (level === "error" || level === "fatal"
      ? process.stderr
      : process.stdout
    ).write(line);
  } catch {
    // Logging must never change application behavior
  }
}

const fallback = Object.freeze({
  debug: () => writeFallback("debug"),
  info: () => writeFallback("info"),
  warn: () => writeFallback("warn"),
  error: () => writeFallback("error"),
  fatal: () => writeFallback("fatal"),
  async flush() {},
});

let applicationLogger = fallback;
let httpLogger = fallback;
let lifecycleLogger = fallback;
let httpMiddleware = (_req, _res, next) => next();
let configuredService;

function configFromEnvironment(service) {
  if (!SERVICES.has(service))
    throw new Error("Unsupported HAB logging service");
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
      throw new Error(
        "Production Ops logging requires a non-placeholder 32-character secret",
      );
    }
  }
  return { project: "habit", service, ingestionUrl, secret, enabled };
}

export function configureLogging(service) {
  if (configuredService && configuredService !== service) {
    throw new Error("HAB logging is already configured for another process");
  }
  if (configuredService) return;
  const config = configFromEnvironment(service);
  configuredService = service;

  if (service.startsWith("hab-api-")) {
    const adapter = createExpressOpsLogger({
      ...config,
      exportLevels: EXPORT_ALL_LEVELS,
    });
    httpLogger = adapter.logger;
    httpMiddleware = adapter.middleware;
    applicationLogger = createOpsLogger({
      ...config,
      getCorrelationId: adapter.getCorrelationId,
    });
  } else {
    applicationLogger = createOpsLogger(config);
    lifecycleLogger = createOpsLogger({
      ...config,
      exportLevels: EXPORT_ALL_LEVELS,
    });
  }
}

function normalizeDetails(values) {
  const supplied = values[0];
  if (
    supplied &&
    typeof supplied === "object" &&
    !(supplied instanceof Error) &&
    ("error" in supplied ||
      "attributes" in supplied ||
      "correlationId" in supplied)
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

export const agendaLifecycleLogger = Object.freeze({
  debug: (...args) => lifecycleLogger.debug(...args),
  info: (...args) => lifecycleLogger.info(...args),
  warn: (...args) => lifecycleLogger.warn(...args),
  error: (...args) => lifecycleLogger.error(...args),
  fatal: (...args) => lifecycleLogger.fatal(...args),
});

export function opsHttpMiddleware(req, res, next) {
  return httpMiddleware(req, res, next);
}

export async function flushLogging() {
  await Promise.allSettled([
    applicationLogger.flush(),
    httpLogger.flush(),
    lifecycleLogger.flush(),
  ]);
}

export function configuredLoggingService() {
  return configuredService;
}
