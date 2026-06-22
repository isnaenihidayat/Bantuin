import { expect, test } from "bun:test";
import { assembleContext, estimateTokens } from "./context";

test("assembles bounded memory, untrusted sources, and newest history", () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `${index}:${"x".repeat(700)}`,
  }));
  const result = assembleContext({
    contextWindowTokens: 4_096,
    systemPrompt: "Jawab dalam Bahasa Indonesia.",
    memories: [{ type: "preference", content: "Suka jawaban ringkas" }],
    sources: [
      { chunkId: "chunk-1", sourceName: "panduan.md", ordinal: 0, content: "Cuti 12 hari." },
    ],
    history,
  });

  expect(result.estimatedInputTokens).toBeLessThanOrEqual(2_048);
  expect(result.messages.at(-1)?.content.startsWith("11:")).toBe(true);
  expect(result.messages.some((message) => message.content.includes("data tidak tepercaya"))).toBe(
    true,
  );
  expect(result.sources.map((source) => source.chunkId)).toEqual(["chunk-1"]);
  expect(estimateTokens("123456")).toBe(2);
});

test("clips oversized owner-controlled context to the hard input budget", () => {
  const result = assembleContext({
    contextWindowTokens: 4_096,
    systemPrompt: "s".repeat(8_000),
    memories: [{ type: "note", content: "m".repeat(2_000) }],
    sources: [
      { chunkId: "chunk-1", sourceName: "besar.md", ordinal: 0, content: "k".repeat(1_200) },
    ],
    history: [{ role: "user", content: "u".repeat(4_000) }],
  });

  expect(result.estimatedInputTokens).toBeLessThanOrEqual(2_048);
  expect(result.messages.at(-1)?.role).toBe("user");
});
