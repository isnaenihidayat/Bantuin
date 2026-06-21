import { afterEach, describe, expect, test } from "bun:test";
import { AgentService } from "@bantuin/agent";
import { loadConfig } from "@bantuin/core";
import { migrateDatabase, openDatabase, type BantuinDatabase } from "@bantuin/db";
import { MockProvider } from "@bantuin/providers";
import { createApp } from "./app";

const databases: BantuinDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

function testApp() {
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  const database = openDatabase(config.databaseUrl);
  migrateDatabase(database);
  databases.push(database);
  return createApp({
    config,
    database,
    agent: new AgentService(new MockProvider()),
  });
}

describe("foundation API", () => {
  test("reports health and readiness", async () => {
    const app = testApp();
    const health = await app.request("/health");
    const ready = await app.request("/ready");

    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok" });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({
      status: "ready",
      checks: { database: "ok", providerConfiguration: "ok" },
    });
  });

  test("publishes an OpenAPI document from route definitions", async () => {
    const response = await testApp().request("/openapi.json");
    const document = (await response.json()) as { paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(document.paths).toHaveProperty("/health");
    expect(document.paths).toHaveProperty("/ready");
  });

  test("streams the deterministic provider vertical slice", async () => {
    const response = await testApp().request("/_foundation/mock-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "halo" }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("Bantuin");
    expect(body).toContain("message.completed");
    expect(body).toContain("[DONE]");
  });

  test("rejects malformed mock requests with a stable validation error", async () => {
    const response = await testApp().request("/_foundation/mock-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  test("reports not ready when the database connection is unavailable", async () => {
    const app = testApp();
    databases.pop()?.close();

    const response = await app.request("/ready");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "not_ready",
      checks: { database: "error" },
    });
  });

  test("returns a stable error envelope", async () => {
    const response = await testApp().request("/missing");
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({ code: "VALIDATION_FAILED", message: "Route not found" });
    expect(body.error.requestId).toMatch(/^req_/);
  });
});
