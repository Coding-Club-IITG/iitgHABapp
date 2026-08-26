import { parseLogEventV1 } from "@coding-club-iitg/ops-contract";

const LOGGING_ENABLED = process.env.OPS_LOGGING_ENABLED === "true";
const INGEST_URL =
  process.env.OPS_LOG_INGEST_URL || "http://localhost:3005/api/ingest/logs";
const INGEST_SECRET = process.env.OPS_LOG_INGEST_SECRET || "";
const PLACEHOLDER_SECRET = /^(?:replace|change[-_ ]?me|your[_-])/i;
const ERROR_TEXT_LIMIT = 2_048;
const STACK_TEXT_LIMIT = 8_000;
const MAX_CAUSE_DEPTH = 3;

if (LOGGING_ENABLED) {
  let ingestUrl;
  try {
    ingestUrl = new URL(INGEST_URL);
  } catch {
    throw new Error("OPS_LOG_INGEST_URL must be a valid HTTP(S) URL");
  }
  const allowedProtocol =
    ingestUrl.protocol === "https:" ||
    (process.env.NODE_ENV !== "production" && ingestUrl.protocol === "http:");
  if (
    !allowedProtocol ||
    INGEST_SECRET.length < 32 ||
    PLACEHOLDER_SECRET.test(INGEST_SECRET)
  ) {
    throw new Error(
      "HTTPS OPS_LOG_INGEST_URL and a 32-character OPS_LOG_INGEST_SECRET are required for production Ops logging",
    );
  }
}

function bounded(value, limit) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.slice(0, limit);
}

/** Explicitly copy Error fields */
export function serializeErrorForOps(error, depth = 0, seen = new WeakSet()) {
  if (!(error instanceof Error)) {
    return {
      name: "NonError",
      message: bounded(String(error), ERROR_TEXT_LIMIT) || "Unknown failure",
    };
  }

  try {
    if (seen.has(error))
      return { name: "Error", message: "Circular error cause" };
    seen.add(error);
    const name = bounded(error.name, 128);
    const stack = bounded(error.stack, STACK_TEXT_LIMIT);
    const code =
      typeof error.code === "string" || typeof error.code === "number"
        ? String(error.code).slice(0, 128)
        : undefined;
    const cause =
      depth < MAX_CAUSE_DEPTH && error.cause !== undefined
        ? serializeErrorForOps(error.cause, depth + 1, seen)
        : undefined;
    return {
      ...(name ? { name } : {}),
      ...(code ? { code } : {}),
      message:
        bounded(error.message, ERROR_TEXT_LIMIT) || "Error details unavailable",
      ...(stack ? { stack } : {}),
      ...(cause ? { cause } : {}),
    };
  } catch {
    return { name: "Error", message: "Error details unavailable" };
  }
}

export async function publishLogEvent(input, diagnosticError) {
  try {
    const event = parseLogEventV1(input);
    if (!LOGGING_ENABLED) return;
    const payload =
      diagnosticError === undefined
        ? event
        : { ...event, error: serializeErrorForOps(diagnosticError) };
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${INGEST_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status !== 202)
      throw new Error("Ops ingestion rejected event");
  } catch {
    // Ops ingestion is best-effort
  }
}

export async function closeOpsTelemetry() {
  // Retained for the Agenda shutdown interface
}
