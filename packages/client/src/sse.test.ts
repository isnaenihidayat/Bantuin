import { describe, expect, test } from "bun:test";
import { encodeSseFrame, parseSseFrames } from "./sse";

describe("SSE codec", () => {
  test("round-trips event data", () => {
    const encoded = encodeSseFrame({ id: "1", event: "message.delta", data: "halo" });

    expect(parseSseFrames(encoded)).toEqual([{ id: "1", event: "message.delta", data: "halo" }]);
  });

  test("ignores keep-alive comments", () => {
    expect(parseSseFrames(": OPENROUTER PROCESSING\n\ndata: [DONE]\n\n")).toEqual([
      { data: "[DONE]" },
    ]);
  });
});
