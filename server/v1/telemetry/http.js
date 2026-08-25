import { isSafeRouteTemplate } from "@coding-club-iitg/ops-contract";

import { buildHttpEvent } from "./event.js";
import { publishLogEvent } from "./publisher.js";

export function resolveRouteTemplate(req) {
  const routePath = req.route?.path;
  if (typeof routePath !== "string") return "unmatched";
  if (routePath === "*") return "*";

  const baseUrl = typeof req.baseUrl === "string" ? req.baseUrl : "";
  const joined = `${baseUrl}${routePath}`.replace(/\/$/, "") || "/";
  return isSafeRouteTemplate(joined) ? joined : "unknown";
}

export function opsHttpTelemetry(req, res, next) {
  const startedAt = performance.now();

  res.once("finish", () => {
    try {
      void publishLogEvent(
        buildHttpEvent({
          method: req.method,
          route: resolveRouteTemplate(req),
          statusCode: res.statusCode,
          durationMs: Math.max(0, performance.now() - startedAt),
          correlationId: req.opsCorrelationId,
        }),
      );
    } catch {
      // Invalid telemetry must never affect response completion
    }
  });

  next();
}
