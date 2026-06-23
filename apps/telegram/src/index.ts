import { BantuinClient } from "@bantuin/client";
import { handleTelegramUpdate, type TelegramUpdate } from "./bridge";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const token = required("TELEGRAM_BOT_TOKEN");
const allowedUserId = required("TELEGRAM_ALLOWED_USER_ID");
const client = new BantuinClient({
  ...(process.env.BANTUIN_API_URL ? { baseUrl: process.env.BANTUIN_API_URL } : {}),
});
await client.login(required("BANTUIN_EMAIL"), required("BANTUIN_PASSWORD"));

async function telegram<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  });
  const result = (await response.json()) as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !result.ok || result.result === undefined) {
    throw new Error(result.description || `Telegram request failed (${response.status})`);
  }
  return result.result;
}

let stopped = false;
let offset = 0;
process.once("SIGINT", () => (stopped = true));
process.once("SIGTERM", () => (stopped = true));
console.log("Bantuin Telegram adapter started for one allowlisted user.");

while (!stopped) {
  try {
    const updates = await telegram<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    });
    for (const update of updates) {
      offset = Math.max(offset, update.update_id + 1);
      await handleTelegramUpdate(update, {
        allowedUserId,
        client,
        sendText: (chatId, text) => telegram("sendMessage", { chat_id: chatId, text }),
      });
    }
  } catch (error) {
    if (!stopped) console.error(error instanceof Error ? error.message : "Telegram polling failed");
    await Bun.sleep(1_000);
  }
}
