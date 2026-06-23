import { expect, test } from "bun:test";
import { logEvent } from "./logger";

function captureConsole(level: "log" | "error", run: () => void): string {
  const original = console[level];
  let captured = "";
  console[level] = ((line: string) => {
    captured = line;
  }) as typeof console.log;
  try {
    run();
  } finally {
    console[level] = original;
  }
  return captured;
}

test("logEvent redacts secret-shaped fields and keeps safe ones", () => {
  const line = captureConsole("log", () =>
    logEvent("info", "request.completed", {
      requestId: "req_1",
      authorization: "Bearer abc123",
      sessionToken: "tok_secret",
      password: "hunter2",
      status: 200,
    }),
  );
  const parsed = JSON.parse(line) as Record<string, unknown>;
  expect(parsed.requestId).toBe("req_1");
  expect(parsed.status).toBe(200);
  expect(parsed.authorization).toBe("[REDACTED]");
  expect(parsed.sessionToken).toBe("[REDACTED]");
  expect(parsed.password).toBe("[REDACTED]");
});

test("logEvent writes error level to console.error", () => {
  const line = captureConsole("error", () =>
    logEvent("error", "request.failed", { code: "INTERNAL_ERROR" }),
  );
  const parsed = JSON.parse(line) as Record<string, unknown>;
  expect(parsed.level).toBe("error");
  expect(parsed.message).toBe("request.failed");
  expect(parsed.code).toBe("INTERNAL_ERROR");
});
