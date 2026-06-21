import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  test("uses local and mock-safe defaults", () => {
    const config = loadConfig({});

    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(4310);
    expect(config.provider).toEqual({ kind: "mock" });
  });

  test("requires OpenRouter credentials and model together", () => {
    expect(() => loadConfig({ BANTUIN_PROVIDER: "openrouter" })).toThrow(
      "OPENROUTER_API_KEY is required",
    );
  });

  test("loads OpenRouter without exposing vendor fields at the root", () => {
    const config = loadConfig({
      BANTUIN_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "test-key",
      OPENROUTER_MODEL: "test/model",
    });

    expect(config.provider).toMatchObject({
      kind: "openrouter",
      model: "test/model",
      appTitle: "Bantuin",
    });
  });
});
