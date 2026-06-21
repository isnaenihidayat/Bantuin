import type { ChatRequest, ChatStreamEvent, ModelProvider } from "@bantuin/core";

export class MockProvider implements ModelProvider {
  readonly id = "mock";

  async *streamChat(
    request: ChatRequest,
    options: { signal?: AbortSignal } = {},
  ): AsyncIterable<ChatStreamEvent> {
    const lastUserMessage = request.messages.findLast((message) => message.role === "user");
    const response = `Bantuin mock: ${lastUserMessage?.content ?? "ready"}`;
    const words = response.split(" ");

    for (const [index, word] of words.entries()) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? new DOMException("Request aborted", "AbortError");
      }

      yield {
        type: "message.delta",
        delta: `${index === 0 ? "" : " "}${word}`,
      };
    }

    const inputTokens = request.messages.reduce(
      (total, message) => total + message.content.split(/\s+/u).filter(Boolean).length,
      0,
    );
    const outputTokens = words.length;

    yield {
      type: "message.usage",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
    yield {
      type: "message.completed",
      finishReason: "stop",
      providerRequestId: `mock_${request.requestId}`,
    };
  }
}
