import { describe, expect, test } from "bun:test";
import { MockProvider } from "./mock-provider";

describe("MockProvider", () => {
  test("streams deterministic content, usage, and completion", async () => {
    const provider = new MockProvider();
    const events = [];

    for await (const event of provider.streamChat({
      requestId: "req_test",
      messages: [{ role: "user", content: "halo" }],
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toContain("message.usage");
    expect(events.at(-1)).toMatchObject({
      type: "message.completed",
      finishReason: "stop",
    });
    expect(
      events
        .filter((event) => event.type === "message.delta")
        .map((event) => event.delta)
        .join(""),
    ).toBe("Bantuin mock: halo");
  });

  test("honors cancellation before producing output", async () => {
    const provider = new MockProvider();
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));

    const consume = async () => {
      for await (const _event of provider.streamChat(
        { requestId: "req_cancel", messages: [] },
        { signal: controller.signal },
      )) {
        // Consume the stream.
      }
    };

    await expect(consume()).rejects.toThrow("cancelled");
  });
});
