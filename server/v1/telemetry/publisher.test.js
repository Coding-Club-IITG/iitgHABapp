import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { buildApplicationEvent } from "./event.js";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  OPS_LOGGING_ENABLED: process.env.OPS_LOGGING_ENABLED,
  OPS_LOG_INGEST_URL: process.env.OPS_LOG_INGEST_URL,
  OPS_LOG_INGEST_SECRET: process.env.OPS_LOG_INGEST_SECRET,
};
const originalFetch = globalThis.fetch;

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
}

function publisherImport(label) {
  return import(`./publisher.js?test=${label}-${Date.now()}-${Math.random()}`);
}

afterEach(restoreEnvironment);

test("serializes non-enumerable Error fields and nested causes", async () => {
  process.env.OPS_LOGGING_ENABLED = "false";
  const { serializeErrorForOps } = await publisherImport("serialize");
  const cause = Object.assign(new Error("database token=private"), {
    code: "ECONNRESET",
  });
  const error = new Error("request failed", { cause });
  error.stack = "Error: request failed\n    at run (/srv/habit/src/job.js:10:2)";

  assert.deepEqual(serializeErrorForOps(error), {
    name: "Error",
    message: "request failed",
    stack: error.stack,
    cause: {
      name: "Error",
      code: "ECONNRESET",
      message: "database token=private",
      stack: cause.stack,
    },
  });
});

test("posts a validated event and explicit diagnostics to Ops", async () => {
  process.env.NODE_ENV = "test";
  process.env.OPS_LOGGING_ENABLED = "true";
  process.env.OPS_LOG_INGEST_URL = "http://ops.example.test/api/ingest/logs";
  process.env.OPS_LOG_INGEST_SECRET =
    "test-ingestion-secret-at-least-32-characters";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { status: 202 };
  };
  const { publishLogEvent } = await publisherImport("publish");
  const event = buildApplicationEvent({
    level: "error",
    message: "Agenda job failed",
    error: { name: "AgendaJobError", code: "JOB_FAILED" },
  });
  const diagnosticError = new Error("token=private-value");

  await publishLogEvent(event, diagnosticError);

  assert.equal(request.url, process.env.OPS_LOG_INGEST_URL);
  assert.equal(request.options.method, "POST");
  assert.equal(
    request.options.headers.authorization,
    `Bearer ${process.env.OPS_LOG_INGEST_SECRET}`,
  );
  assert.deepEqual(JSON.parse(request.options.body), {
    ...event,
    error: {
      name: "Error",
      message: "token=private-value",
      stack: diagnosticError.stack,
    },
  });
});

test("ingestion failures never change application behavior", async () => {
  process.env.NODE_ENV = "test";
  process.env.OPS_LOGGING_ENABLED = "true";
  process.env.OPS_LOG_INGEST_URL = "http://ops.example.test/api/ingest/logs";
  process.env.OPS_LOG_INGEST_SECRET =
    "test-ingestion-secret-at-least-32-characters";
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  const { publishLogEvent } = await publisherImport("failure");
  await assert.doesNotReject(() =>
    publishLogEvent(
      buildApplicationEvent({ level: "info", message: "Worker ready" }),
    ),
  );
});

test("production logging rejects non-HTTPS ingestion", async () => {
  process.env.NODE_ENV = "production";
  process.env.OPS_LOGGING_ENABLED = "true";
  process.env.OPS_LOG_INGEST_URL = "http://ops.example.test/api/ingest/logs";
  process.env.OPS_LOG_INGEST_SECRET =
    "production-ingestion-secret-at-least-32-characters";
  await assert.rejects(publisherImport("insecure"), /HTTPS OPS_LOG_INGEST_URL/);
});

test("production logging rejects placeholder secrets", async () => {
  process.env.NODE_ENV = "production";
  process.env.OPS_LOGGING_ENABLED = "true";
  process.env.OPS_LOG_INGEST_URL =
    "https://ops.example.test/api/ingest/logs";
  process.env.OPS_LOG_INGEST_SECRET =
    "replace_with_same_32_character_secret_as_ops";
  await assert.rejects(
    publisherImport("placeholder"),
    /32-character OPS_LOG_INGEST_SECRET/,
  );
});
