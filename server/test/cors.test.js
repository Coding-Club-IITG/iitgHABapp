import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cors from "cors";

import { corsOriginCheck } from "../cors.js";

async function withServer(fn) {
  const app = express();
  app.use(cors({ origin: corsOriginCheck, credentials: true }));
  app.get("/ping", (req, res) => res.send("ok"));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(`http://localhost:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("allowed origin is reflected with credentials", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/ping`, {
      headers: { Origin: "https://hab.codingclub.in" },
    });
    assert.equal(
      res.headers.get("access-control-allow-origin"),
      "https://hab.codingclub.in",
    );
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  });
});

test("unknown origin gets no CORS headers", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/ping`, {
      headers: { Origin: "https://evil.example.com" },
    });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });
});

test("unknown origin preflight is not approved", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/ping`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });
});

test("requests without an origin (mobile apps) are allowed", () => {
  corsOriginCheck(undefined, (err, allowed) => {
    assert.equal(err, null);
    assert.equal(allowed, true);
  });
});
