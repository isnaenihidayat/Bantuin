import { describe, expect, test } from "bun:test";
import { cronMatches, safeRunText, validCron } from "./safe-actions";

describe("safe action boundaries", () => {
  test("validates native cron matching and redacts run output", () => {
    const date = new Date("2026-06-23T03:15:00.000Z");
    expect(validCron("15 10 * * 2")).toBe(true);
    expect(validCron("invalid cron")).toBe(false);
    expect(validCron("1-2-3 * * * *")).toBe(false);
    expect(cronMatches("15 10 * * 2", date, "Asia/Jakarta")).toBe(true);
    expect(safeRunText("Authorization: Bearer secret-token api_key=abcdef")).toBe(
      "Authorization: Bearer [REDACTED] api_key=[REDACTED]",
    );
  });
});
