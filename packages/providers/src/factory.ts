import type { AppConfig, ModelProvider } from "@bantuin/core";
import { MockProvider } from "./mock-provider";
import { OpenRouterProvider } from "./openrouter-provider";

export function createProvider(config: AppConfig["provider"]): ModelProvider {
  if (config.kind === "openrouter") {
    return new OpenRouterProvider(config);
  }

  return new MockProvider();
}
