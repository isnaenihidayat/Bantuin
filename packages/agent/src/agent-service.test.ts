import { expect, test } from "bun:test";
import type { ChatRequest, ChatStreamEvent, ModelProvider } from "@bantuin/core";
import { AgentService } from "./agent-service";

class TestProvider implements ModelProvider {
  readonly id = "test";

  async *streamChat(_request: ChatRequest): AsyncIterable<ChatStreamEvent> {
    yield { type: "message.completed", finishReason: "stop" };
  }
}

test("AgentService delegates through the provider-neutral contract", async () => {
  const service = new AgentService(new TestProvider());
  const eventTypes = [];

  for await (const event of service.streamReply({
    requestId: "req_agent",
    messages: [{ role: "user", content: "test" }],
  })) {
    eventTypes.push(event.type);
  }

  expect(eventTypes.at(-1)).toBe("message.completed");
  expect(await service.contextWindowTokens()).toBe(8_192);
});
