import type { ChatRequest, ChatStreamEvent, ModelProvider } from "@bantuin/core";

export class AgentService {
  readonly #provider: ModelProvider;

  constructor(provider: ModelProvider) {
    this.#provider = provider;
  }

  contextWindowTokens(): Promise<number> {
    return this.#provider.contextWindowTokens?.() ?? Promise.resolve(8_192);
  }

  streamReply(
    request: ChatRequest,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<ChatStreamEvent> {
    return this.#provider.streamChat(request, options);
  }
}
