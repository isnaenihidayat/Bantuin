import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, restoreDatabase } from "./database-backup";

const directory = await mkdtemp(join(tmpdir(), "bantuin-release-"));
const port = 55_500 + Math.floor(Math.random() * 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const databaseUrl = `file:${join(directory, "bantuin.sqlite")}`;
const mutationHeaders = {
  "content-type": "application/json",
  origin: baseUrl,
  "x-csrf-token": "1",
};

function step(name: string): void {
  console.error(`release-smoke: ${name} (${baseUrl})`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitReady(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/ready`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await Bun.sleep(100);
  }
  throw new Error("API did not become ready");
}

async function json<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(5_000),
    ...init,
  });
  return { response, body: (await response.json()) as T };
}

const server = Bun.spawn(["bun", "apps/api/src/index.ts"], {
  env: {
    ...process.env,
    BANTUIN_HOST: "127.0.0.1",
    BANTUIN_PORT: String(port),
    BANTUIN_PUBLIC_ORIGIN: baseUrl,
    DATABASE_URL: databaseUrl,
    BANTUIN_PROVIDER: "mock",
  },
  stdout: "ignore",
  stderr: "pipe",
});

try {
  step("waiting for API");
  await waitReady();

  step("checking web/a11y");
  const root = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
  assert(root.status === 200, "web root must load");
  const html = await root.text();
  assert(html.includes('<html lang="id">'), "HTML must declare Indonesian language");
  assert(html.includes('name="viewport"'), "HTML must include viewport meta");
  assert(html.includes("<title>Bantuin</title>"), "HTML must include product title");
  assert(html.includes('id="root"'), "HTML must include React root");

  const mainSource = await Bun.file("apps/web/src/main.tsx").text();
  assert(mainSource.includes("skip-link"), "auth screen must include skip link");
  assert(mainSource.includes('role="alert"'), "auth errors must be announced");
  assert(mainSource.includes("Email pemilik"), "auth form must label email input");
  assert(mainSource.includes("Kata sandi"), "auth form must label password input");

  step("checking health");
  const health = await json<{ apiVersion: string }>("/health");
  assert(health.response.status === 200, "health must return 200");
  assert(health.body.apiVersion === "1.0.0-rc.1", "health must expose release candidate version");

  step("checking setup status");
  const setupStatus = await json<{ setupComplete: boolean }>("/v1/setup/status");
  assert(setupStatus.body.setupComplete === false, "fresh release DB must require setup");

  step("posting setup");
  const setup = await json<{ owner: { email: string }; profile: { name: string } }>("/v1/setup", {
    method: "POST",
    headers: mutationHeaders,
    body: JSON.stringify({
      email: "release@example.test",
      password: "correct horse battery staple",
      assistantName: "Bantuin",
    }),
  });
  assert(setup.response.status === 201, "setup must create owner");
  assert(setup.body.owner.email === "release@example.test", "setup must normalize owner email");
  const cookie = setup.response.headers.get("set-cookie")?.split(";", 1)[0];
  assert(cookie, "setup must return session cookie");

  step("creating session");
  const authHeaders = { ...mutationHeaders, cookie };
  const session = await json<{ session: { id: string } }>("/v1/sessions", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ title: "Release smoke" }),
  });
  assert(session.response.status === 201, "session create must pass");

  step("checking status");
  const status = await json<{
    database: string;
    provider: string;
    usage: { requestCount: number };
  }>("/v1/system/status", {
    headers: { cookie },
  });
  assert(status.body.database === "ok", "status must report database ok");
  assert(status.body.provider === "mock", "status must report mock provider");

  step("checking backup/load");
  const backup = await backupDatabase(databaseUrl, join(directory, "backups"));
  await restoreDatabase(backup.manifestPath, `file:${join(directory, "restored.sqlite")}`);

  const started = performance.now();
  const responses = await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      fetch(`${baseUrl}${index % 2 ? "/ready" : "/health"}`, {
        signal: AbortSignal.timeout(5_000),
      }).then((response) => response.status),
    ),
  );
  const durationMs = performance.now() - started;
  assert(
    responses.every((statusCode) => statusCode === 200),
    "load smoke must return only 200s",
  );
  assert(durationMs < 2_000, "40 health/readiness requests should finish under 2s locally");

  console.log(
    JSON.stringify({
      status: "ok",
      checks: ["e2e", "static-a11y", "backup-restore", "load-smoke"],
      loadRequests: responses.length,
      loadDurationMs: Math.round(durationMs),
      backupManifest: backup.manifestPath,
    }),
  );
} catch (error) {
  const stderr = server.stderr ? await new Response(server.stderr).text() : "";
  if (stderr) console.error(stderr);
  throw error;
} finally {
  server.kill("SIGTERM");
  await Promise.race([
    server.exited,
    Bun.sleep(2_000).then(() => {
      server.kill("SIGKILL");
    }),
  ]).catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
