import { expect, test } from "bun:test";
import { handleTelegramUpdate } from "./bridge";

test("Telegram bridge authorizes one user and no-ops duplicate inbound messages", async () => {
  const sent: string[] = [];
  let duplicate = false;
  const client = {
    claimTelegramMessage: async () => ({ sessionId: "ses_1", duplicate }),
    sendMessage: async () => "Halo dari Bantuin",
  };
  const update = {
    update_id: 1,
    message: {
      message_id: 7,
      text: "Halo",
      chat: { id: 99, type: "private" },
      from: { id: 42 },
    },
  };

  expect(
    await handleTelegramUpdate(update, {
      allowedUserId: "42",
      client,
      sendText: async (_chatId, text) => void sent.push(text),
    }),
  ).toBe("handled");
  duplicate = true;
  expect(
    await handleTelegramUpdate(update, {
      allowedUserId: "42",
      client,
      sendText: async (_chatId, text) => void sent.push(text),
    }),
  ).toBe("duplicate");
  expect(sent).toEqual(["Halo dari Bantuin"]);
  expect(
    await handleTelegramUpdate(update, {
      allowedUserId: "100",
      client,
      sendText: async () => {
        throw new Error("unauthorized user must not receive a reply");
      },
    }),
  ).toBe("ignored");
});
