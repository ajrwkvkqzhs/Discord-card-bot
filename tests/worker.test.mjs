import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const base = "https://example.workers.dev";
const okDb = { prepare: () => ({ first: async () => ({ connected: 1 }) }) };

test("root responds without authentication", async () => {
  const response = await worker.fetch(new Request(base + "/"), {});
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Discord Card Bot/);
});

test("/health confirms an available D1 binding", async () => {
  const response = await worker.fetch(new Request(base + "/health"), { DB: okDb });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { worker: "OK", database: "OK" });
});

test("/health reports missing D1 binding", async () => {
  const response = await worker.fetch(new Request(base + "/health"), {});
  assert.equal(response.status, 500);
});

test("Discord interactions reject non-POST requests", async () => {
  const response = await worker.fetch(new Request(base + "/interactions"), {});
  assert.equal(response.status, 405);
});

test("Discord interactions reject requests without signature headers", async () => {
  const response = await worker.fetch(
    new Request(base + "/interactions", { method: "POST", body: "{}" }),
    {}
  );
  assert.equal(response.status, 401);
});
