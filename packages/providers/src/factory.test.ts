import { expect, test } from "bun:test";
import { createProvider } from "./factory";

test("createProvider keeps OpenRouter behind the model-provider contract", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = Object.assign(
    (input: string | URL | Request) => {
      requestedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify({ data: { context_length: 32_768 } }), { status: 200 }),
      );
    },
    { preconnect: originalFetch.preconnect },
  );
  const provider = createProvider({
    kind: "openrouter",
    apiKey: "test-only-key",
    model: "test/model",
    appTitle: "Bantuin Test",
  });

  expect(provider.id).toBe("openrouter");
  expect(provider.streamChat).toBeFunction();
  expect(JSON.stringify(provider)).not.toContain("test-only-key");
  expect(await provider.contextWindowTokens?.()).toBe(32_768);
  expect(requestedUrl).toBe("https://openrouter.ai/api/v1/model/test/model");
  globalThis.fetch = originalFetch;
});
