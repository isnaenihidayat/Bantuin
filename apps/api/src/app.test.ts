import { afterEach, describe, expect, test } from "bun:test";
import { AgentService } from "@bantuin/agent";
import {
  type ChatRequest,
  type ChatStreamEvent,
  loadConfig,
  type ModelProvider,
} from "@bantuin/core";
import {
  migrateDatabase,
  openDatabase,
  type BantuinDatabase,
  type MessageRecord,
} from "@bantuin/db";
import { MockProvider } from "@bantuin/providers";
import { createApp } from "./app";

const databases: BantuinDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

function testApp(provider: ModelProvider = new MockProvider()) {
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  const database = openDatabase(config.databaseUrl);
  migrateDatabase(database);
  databases.push(database);
  return createApp({
    config,
    database,
    agent: new AgentService(provider),
  });
}

class CancelThenCompleteProvider implements ModelProvider {
  readonly id = "cancel-then-complete";
  calls = 0;

  async *streamChat(
    _request: ChatRequest,
    options: { signal?: AbortSignal } = {},
  ): AsyncIterable<ChatStreamEvent> {
    this.calls += 1;
    yield { type: "message.delta", delta: this.calls === 1 ? "Sebagian" : "Selesai" };
    if (this.calls === 1) {
      await new Promise<void>((_resolve, reject) => {
        if (options.signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
        options.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        );
      });
    }
    yield { type: "message.completed", finishReason: "stop" };
  }
}

describe("foundation API", () => {
  test("reports health and readiness", async () => {
    const app = testApp();
    const health = await app.request("/health");
    const ready = await app.request("/ready");

    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok" });
    expect(health.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
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
    expect(document.paths).toHaveProperty("/v1/setup");
    expect(document.paths).toHaveProperty("/v1/sessions/{id}/messages");
    expect(document.paths).toHaveProperty("/v1/messages/{id}/cancel");
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

describe("core chat authentication", () => {
  const mutationHeaders = {
    "content-type": "application/json",
    origin: "http://127.0.0.1:4310",
    "x-csrf-token": "1",
  };

  test("protects setup and creates one durable owner session", async () => {
    const app = testApp();
    expect(await (await app.request("/v1/setup/status")).json()).toEqual({
      setupComplete: false,
    });

    const rejected = await app.request("/v1/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.test",
        password: "correct horse battery staple",
        assistantName: "Bantuin",
      }),
    });
    expect(rejected.status).toBe(403);

    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "OWNER@example.test",
        password: "correct horse battery staple",
        assistantName: "Bantuin",
      }),
    });
    const setupBody = (await setup.json()) as { owner: { email: string } };
    const cookie = setup.headers.get("set-cookie")?.split(";", 1)[0];

    expect(setup.status).toBe(201);
    expect(setupBody.owner.email).toBe("owner@example.test");
    expect(setup.headers.get("set-cookie")).toContain("HttpOnly");
    expect(setup.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(cookie).toBeTruthy();

    const me = await app.request("/v1/me", { headers: { cookie: cookie ?? "" } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      owner: { email: "owner@example.test" },
      profile: { name: "Bantuin" },
    });

    const duplicate = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "other@example.test",
        password: "another correct horse battery staple",
      }),
    });
    expect(duplicate.status).toBe(409);
  });

  test("uses generic login failures and rotates sessions", async () => {
    const app = testApp();
    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "owner@example.test",
        password: "correct horse battery staple",
      }),
    });
    const firstCookie = setup.headers.get("set-cookie")?.split(";", 1)[0];

    const failed = await app.request("/v1/auth/login", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ email: "owner@example.test", password: "wrong" }),
    });
    expect(failed.status).toBe(401);
    expect(await failed.json()).toMatchObject({
      error: { code: "AUTHENTICATION_FAILED", message: "Email or password is incorrect" },
    });

    const login = await app.request("/v1/auth/login", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "owner@example.test",
        password: "correct horse battery staple",
      }),
    });
    const secondCookie = login.headers.get("set-cookie")?.split(";", 1)[0];
    const loginBody = JSON.stringify(await login.json());

    expect(login.status).toBe(200);
    expect(secondCookie).toBeTruthy();
    expect(secondCookie).not.toBe(firstCookie);
    expect(loginBody).not.toContain("passwordHash");

    const logout = await app.request("/v1/auth/logout", {
      method: "POST",
      headers: { ...mutationHeaders, cookie: secondCookie ?? "" },
    });
    expect(logout.status).toBe(204);
    expect((await app.request("/v1/me", { headers: { cookie: secondCookie ?? "" } })).status).toBe(
      401,
    );
  });

  test("rate limits repeated login failures", async () => {
    const app = testApp();
    await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "owner@example.test",
        password: "correct horse battery staple",
      }),
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await app.request("/v1/auth/login", {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ email: "owner@example.test", password: "wrong" }),
      });
      expect(failed.status).toBe(401);
    }
    const limited = await app.request("/v1/auth/login", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ email: "owner@example.test", password: "wrong" }),
    });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      error: { code: "AUTHENTICATION_RATE_LIMITED" },
    });
  });

  test("persists ordered chat history and deduplicates client requests", async () => {
    const app = testApp();
    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "owner@example.test",
        password: "correct horse battery staple",
      }),
    });
    const cookie = setup.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const authenticatedHeaders = { ...mutationHeaders, cookie };

    const profile = await app.request("/v1/profile", {
      method: "PATCH",
      headers: authenticatedHeaders,
      body: JSON.stringify({ name: "Nia", systemPrompt: "Jawab ringkas dalam Bahasa Indonesia." }),
    });
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({ profile: { name: "Nia" } });

    const createdSession = await app.request("/v1/sessions", {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ title: "Percakapan pertama" }),
    });
    const sessionBody = (await createdSession.json()) as { session: { id: string } };
    expect(createdSession.status).toBe(201);

    const send = () =>
      app.request(`/v1/sessions/${sessionBody.session.id}/messages`, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({ message: "Halo", clientRequestId: "request-0001" }),
      });
    const firstStream = await send();
    expect(await firstStream.text()).toContain("message.completed");
    const duplicateStream = await send();
    expect(await duplicateStream.text()).toContain("message.accepted");

    const history = await app.request(`/v1/sessions/${sessionBody.session.id}/messages`, {
      headers: { cookie },
    });
    const historyBody = (await history.json()) as {
      messages: Array<{ sequence: number; role: string; status: string; content: string }>;
    };
    expect(historyBody.messages).toHaveLength(2);
    expect(historyBody.messages).toMatchObject([
      { sequence: 1, role: "user", status: "completed", content: "Halo" },
      { sequence: 2, role: "assistant", status: "completed", content: "Bantuin mock: Halo" },
    ]);
  });

  test("cancels a stream and explicitly retries without duplicating the user message", async () => {
    const provider = new CancelThenCompleteProvider();
    const app = testApp(provider);
    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "owner@example.test",
        password: "correct horse battery staple",
      }),
    });
    const cookie = setup.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const headers = { ...mutationHeaders, cookie };
    const createdSession = await app.request("/v1/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Cancel test" }),
    });
    const { session } = (await createdSession.json()) as { session: { id: string } };
    const response = await app.request(`/v1/sessions/${session.id}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "Jawab panjang", clientRequestId: "cancel-request-1" }),
    });
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    if (!reader) throw new Error("Expected streaming response body");
    const decoder = new TextDecoder();
    let streamed = "";
    let assistantId: string | undefined;
    while (!assistantId) {
      const part = await reader.read();
      if (part.done) break;
      streamed += decoder.decode(part.value);
      assistantId = streamed.match(/"id":"(msg_[^"]+)"/)?.[1];
    }
    expect(assistantId).toBeTruthy();

    const cancelled = await app.request(`/v1/messages/${assistantId}/cancel`, {
      method: "POST",
      headers,
    });
    expect(cancelled.status).toBe(200);
    while (!(await reader.read()).done) {
      // Drain the cancelled stream.
    }

    const retry = await app.request(`/v1/messages/${assistantId}/retry`, {
      method: "POST",
      headers,
      body: JSON.stringify({ clientRequestId: "retry-request-1" }),
    });
    expect(await retry.text()).toContain("message.completed");

    const history = await app.request(`/v1/sessions/${session.id}/messages`, {
      headers: { cookie },
    });
    const body = (await history.json()) as { messages: MessageRecord[] };
    expect(body.messages).toMatchObject([
      { role: "user", status: "completed", content: "Jawab panjang" },
      { role: "assistant", status: "cancelled", content: "Sebagian" },
      { role: "assistant", status: "completed", content: "Selesai" },
    ]);
  });
});
