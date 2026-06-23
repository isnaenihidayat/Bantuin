export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { id?: number };
  };
};

export type TelegramClient = {
  claimTelegramMessage(input: {
    externalUserId: string;
    externalMessageId: string;
  }): Promise<{ sessionId: string; duplicate: boolean }>;
  sendMessage(sessionId: string, message: string, clientRequestId?: string): Promise<string>;
};

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  options: {
    allowedUserId: string;
    client: TelegramClient;
    sendText: (chatId: string, text: string) => Promise<void>;
  },
): Promise<"ignored" | "duplicate" | "handled"> {
  const message = update.message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  const messageId = message?.message_id;
  const text = message?.text?.trim();
  if (
    message?.chat?.type !== "private" ||
    chatId === undefined ||
    userId === undefined ||
    messageId === undefined ||
    String(userId) !== options.allowedUserId ||
    !text
  ) {
    return "ignored";
  }

  const externalMessageId = `${chatId}:${messageId}`;
  const claim = await options.client.claimTelegramMessage({
    externalUserId: String(userId),
    externalMessageId,
  });
  if (claim.duplicate) return "duplicate";
  const reply = await options.client.sendMessage(
    claim.sessionId,
    text,
    `telegram:${externalMessageId}`,
  );
  await options.sendText(String(chatId), reply || "(balasan kosong)");
  return "handled";
}
