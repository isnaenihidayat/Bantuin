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

class CapturingProvider implements ModelProvider {
  readonly id = "capturing";
  requests: ChatRequest[] = [];

  contextWindowTokens(): Promise<number> {
    return Promise.resolve(4_096);
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatStreamEvent> {
    this.requests.push(request);
    yield { type: "message.delta", delta: "Cuti tahunan adalah 12 hari." };
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

  test("manages explicit memory, cites local knowledge, and exports owner data safely", async () => {
    const provider = new CapturingProvider();
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

    const createdMemory = await app.request("/v1/memories", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "preference", content: "Panggil saya Isnaeni" }),
    });
    const { memory } = (await createdMemory.json()) as { memory: { id: string } };
    expect(createdMemory.status).toBe(201);

    const createdKnowledge = await app.request("/v1/knowledge", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sourceName: "kebijakan.md",
        content: "Kebijakan cuti tahunan adalah 12 hari.",
      }),
    });
    const { document } = (await createdKnowledge.json()) as { document: { id: string } };
    expect(createdKnowledge.status).toBe(201);
    expect(
      (
        await app.request("/v1/knowledge", {
          method: "POST",
          headers,
          body: JSON.stringify({
            sourceName: "salinan.md",
            content: "Kebijakan cuti tahunan adalah 12 hari.",
          }),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request("/v1/knowledge", {
          method: "POST",
          headers,
          body: JSON.stringify({ sourceName: "data.pdf", content: "teks" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request("/v1/knowledge", {
          method: "POST",
          headers,
          body: JSON.stringify({ sourceName: "besar.txt", content: "x".repeat(1024 * 1024 + 1) }),
        })
      ).status,
    ).toBe(413);

    const createdSession = await app.request("/v1/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Memory test" }),
    });
    const { session } = (await createdSession.json()) as { session: { id: string } };
    const response = await app.request(`/v1/sessions/${session.id}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Berapa cuti tahunan?",
        clientRequestId: "memory-request-1",
      }),
    });
    const stream = await response.text();
    expect(stream).toContain("context.sources");
    expect(stream).toContain("kebijakan.md");
    expect(
      provider.requests[0]?.messages.some((message) => message.content.includes("Isnaeni")),
    ).toBe(true);
    expect(
      provider.requests[0]?.messages.some((message) =>
        message.content.includes("data tidak tepercaya"),
      ),
    ).toBe(true);
    expect(provider.requests[0]?.maxTokens).toBe(1_024);

    await app.request(`/v1/memories/${memory.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "archived" }),
    });
    const askInNewSession = async (message: string, clientRequestId: string) => {
      const created = await app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Recall check" }),
      });
      const body = (await created.json()) as { session: { id: string } };
      return app.request(`/v1/sessions/${body.session.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message, clientRequestId }),
      });
    };
    await (await askInNewSession("Siapa nama saya?", "memory-request-2")).text();
    expect(
      provider.requests
        .at(-1)
        ?.messages.some((message) => message.content.includes("Panggil saya")),
    ).toBe(false);

    await app.request(`/v1/memories/${memory.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "active", content: "Panggil saya Neni" }),
    });
    await (await askInNewSession("Siapa nama saya?", "memory-request-3")).text();
    expect(
      provider.requests.at(-1)?.messages.some((message) => message.content.includes("Neni")),
    ).toBe(true);

    const history = (await (
      await app.request(`/v1/sessions/${session.id}/messages`, { headers: { cookie } })
    ).json()) as { messages: Array<{ sources: Array<{ sourceName: string }> }> };
    expect(history.messages.at(-1)?.sources).toEqual([
      expect.objectContaining({ sourceName: "kebijakan.md" }),
    ]);

    const exported = await app.request("/v1/export", { headers: { cookie } });
    const exportText = await exported.text();
    expect(exported.status).toBe(200);
    expect(exportText).toContain("Panggil saya Neni");
    expect(exportText).not.toContain("Panggil saya Isnaeni");
    expect(exportText).toContain("Kebijakan cuti tahunan");
    expect(exportText).not.toContain("passwordHash");
    expect(exportText).not.toContain("tokenHash");
    expect(exportText).not.toContain("apiKey");

    expect(
      (
        await app.request(`/v1/memories/${memory.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(204);
    await (await askInNewSession("Siapa nama saya?", "memory-request-4")).text();
    expect(
      provider.requests.at(-1)?.messages.some((message) => message.content.includes("Neni")),
    ).toBe(false);
    expect(
      (
        await app.request(`/v1/knowledge/${document.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(204);
    const afterKnowledgeDelete = await askInNewSession("Berapa cuti tahunan?", "memory-request-5");
    expect(await afterKnowledgeDelete.text()).not.toContain("context.sources");
    expect(await (await app.request("/v1/memories", { headers: { cookie } })).json()).toEqual({
      memories: [],
    });
    expect(await (await app.request("/v1/knowledge", { headers: { cookie } })).json()).toEqual({
      documents: [],
    });
  });

  test("isolates profiles, stores bounded attachments, and branches durable history", async () => {
    const provider = new CapturingProvider();
    const app = testApp(provider);
    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "phase2@example.test",
        password: "correct horse battery staple",
      }),
    });
    const cookie = setup.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const headers = { ...mutationHeaders, cookie };
    const firstProfile = ((await setup.json()) as { profile: { id: string } }).profile;
    const createdProfile = await app.request("/v1/profiles", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Raka",
        systemPrompt: "Jawab sebagai Raka.",
        providerModel: "mock",
      }),
    });
    const secondProfile = ((await createdProfile.json()) as { profile: { id: string } }).profile;
    expect(createdProfile.status).toBe(201);

    const createdSession = await app.request("/v1/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({ profileId: secondProfile.id, title: "Percakapan baru" }),
    });
    const session = ((await createdSession.json()) as { session: { id: string } }).session;
    const response = await app.request(`/v1/sessions/${session.id}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Jelaskan lampiran",
        clientRequestId: "phase2-message-1",
        attachments: [
          {
            kind: "image",
            filename: "contoh.png",
            mediaType: "image/png",
            data: "AQID",
          },
          {
            kind: "document",
            filename: "catatan.txt",
            mediaType: "text/plain",
            data: Buffer.from("Isi dokumen").toString("base64"),
          },
        ],
      }),
    });
    expect(await response.text()).toContain("message.completed");
    expect(provider.requests.at(-1)).toMatchObject({ model: "mock" });
    expect(provider.requests.at(-1)?.messages.at(-1)?.images).toHaveLength(1);
    expect(provider.requests.at(-1)?.messages.at(-1)?.content).toContain("Isi dokumen");

    const history = (await (
      await app.request(`/v1/sessions/${session.id}/messages`, { headers: { cookie } })
    ).json()) as {
      messages: Array<{ id: string; role: string; attachments: unknown[] }>;
    };
    expect(history.messages[0]?.attachments).toHaveLength(2);
    expect(
      (
        await app.request(`/v1/sessions/${session.id}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: "Lampiran rusak",
            clientRequestId: "phase2-invalid-attachment",
            attachments: [
              {
                kind: "image",
                filename: "rusak.png",
                mediaType: "image/png",
                data: "bukan base64!",
              },
            ],
          }),
        })
      ).status,
    ).toBe(400);
    const assistantId = history.messages.find((message) => message.role === "assistant")?.id;
    const branch = await app.request(`/v1/sessions/${session.id}/branch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messageId: assistantId }),
    });
    const branchedSession = ((await branch.json()) as { session: { id: string } }).session;
    expect(branch.status).toBe(201);
    const branchedHistory = await app.request(`/v1/sessions/${branchedSession.id}/messages`, {
      headers: { cookie },
    });
    expect(((await branchedHistory.json()) as { messages: unknown[] }).messages).toHaveLength(2);

    expect(
      (
        await app.request(`/v1/profiles/${secondProfile.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await app.request(`/v1/profiles/${firstProfile.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(409);
    expect(
      (await app.request(`/v1/sessions/${session.id}/messages`, { headers: { cookie } })).status,
    ).toBe(200);
  });

  test("runs prompt-only tasks and keeps MCP metadata non-executable", async () => {
    const provider = new CapturingProvider();
    const app = testApp(provider);
    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "actions@example.test",
        password: "correct horse battery staple",
      }),
    });
    const cookie = setup.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const headers = { ...mutationHeaders, cookie };
    const profile = ((await setup.json()) as { profile: { id: string } }).profile;

    const created = await app.request("/v1/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        profileId: profile.id,
        title: "Ringkas",
        prompt: "Ringkas hari ini",
        status: "todo",
      }),
    });
    const task = ((await created.json()) as { task: { id: string } }).task;
    expect(created.status).toBe(201);
    expect(
      (await app.request(`/v1/tasks/${task.id}/run`, { method: "POST", headers })).status,
    ).toBe(202);
    await Bun.sleep(5);
    const runs = (await (
      await app.request(`/v1/tasks/${task.id}/runs`, { headers: { cookie } })
    ).json()) as {
      runs: Array<{ status: string; output: string }>;
    };
    expect(runs.runs[0]).toMatchObject({
      status: "completed",
      output: "Cuti tahunan adalah 12 hari.",
    });

    expect(
      (
        await app.request("/v1/automations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "Rusak",
            prompt: "Tes",
            triggerType: "schedule",
            cron: "not cron",
            timezone: "UTC",
          }),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await app.request("/v1/mcp-servers", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "Lokal",
            url: "http://127.0.0.1:3000",
            profileId: profile.id,
          }),
        })
      ).status,
    ).toBe(400);
    const metadata = await app.request("/v1/mcp-servers", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Referensi",
        url: "https://mcp.example.test",
        profileId: profile.id,
        cachedTools: [{ name: "search", description: "Metadata only" }],
      }),
    });
    expect(metadata.status).toBe(201);
    expect(await metadata.json()).toMatchObject({ server: { enabled: false } });
    expect(provider.requests.at(-1)?.messages.at(-1)?.content).toBe("Ringkas hari ini");
  });

  test("cancels an owner-scoped prompt run durably", async () => {
    const app = testApp(new CancelThenCompleteProvider());
    const setup = await app.request("/v1/setup", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "cancel-run@example.test",
        password: "correct horse battery staple",
      }),
    });
    const cookie = setup.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const headers = { ...mutationHeaders, cookie };
    const taskResponse = await app.request("/v1/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Tunggu", prompt: "Tunggu", status: "todo" }),
    });
    const task = ((await taskResponse.json()) as { task: { id: string } }).task;
    const started = await app.request(`/v1/tasks/${task.id}/run`, { method: "POST", headers });
    const run = ((await started.json()) as { run: { id: string } }).run;
    expect(
      (await app.request(`/v1/runs/${run.id}/cancel`, { method: "POST", headers })).status,
    ).toBe(200);
    await Bun.sleep(5);
    const history = (await (
      await app.request(`/v1/tasks/${task.id}/runs`, { headers: { cookie } })
    ).json()) as {
      runs: Array<{ status: string; error: string }>;
    };
    expect(history.runs[0]).toMatchObject({
      status: "cancelled",
      error: "RUN_CANCELLED_OR_TIMED_OUT",
    });
  });
});
