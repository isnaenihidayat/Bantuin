import { expect, test } from "bun:test";
import { createProvider } from "./factory";

test("createProvider keeps OpenRouter behind the model-provider contract", () => {
  const provider = createProvider({
    kind: "openrouter",
    apiKey: "test-only-key",
    model: "test/model",
    appTitle: "Bantuin Test",
  });

  expect(provider.id).toBe("openrouter");
  expect(provider.streamChat).toBeFunction();
  expect(JSON.stringify(provider)).not.toContain("test-only-key");
});
