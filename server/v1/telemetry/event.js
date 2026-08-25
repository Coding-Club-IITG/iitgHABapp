import { randomUUID } from "node:crypto";
import { parseLogEventV1 } from "@coding-club-iitg/ops-contract";


export function buildApplicationEvent({
  level,
  message,
  correlationId,
  error,
  attributes,
}) {
  return parseLogEventV1({
    schemaVersion: 1,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    project: "habit",
    service: "hab-worker-agenda-v1",
    environment: "production",
    kind: "application",
    level,
    message,
    ...(correlationId ? { correlationId } : {}),
    ...(error ? { error } : {}),
    ...(attributes ? { attributes } : {}),
  });
}

export function buildHttpEvent({
  method,
  route,
  statusCode,
  durationMs,
  correlationId,
}) {
  const failed = statusCode >= 500;
  const rejected = statusCode >= 400 && !failed;

  return parseLogEventV1({
    schemaVersion: 1,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    project: "habit",
    service: "hab-api-v1",
    environment: "production",
    kind: "http",
    level: failed ? "error" : rejected ? "warn" : "info",
    message: failed
      ? "HTTP request failed"
      : rejected
        ? "HTTP request rejected"
        : "HTTP request completed",
    ...(correlationId ? { correlationId } : {}),
    http: {
      method: method.toUpperCase(),
      route,
      statusCode,
      durationMs,
    },
    ...(failed
      ? { error: { name: "HttpServerError", code: `HTTP_${statusCode}` } }
      : {}),
    attributes: {
      component: "express",
      outcome: failed ? "failure" : rejected ? "rejected" : "success",
    },
  });
}
