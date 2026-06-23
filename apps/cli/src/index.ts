import { BantuinClient } from "@bantuin/client";
import { createInterface } from "node:readline/promises";

const email = process.env.BANTUIN_EMAIL?.trim();
const password = process.env.BANTUIN_PASSWORD;
if (!email || !password) {
  throw new Error("BANTUIN_EMAIL and BANTUIN_PASSWORD are required");
}

const client = new BantuinClient({
  ...(process.env.BANTUIN_API_URL ? { baseUrl: process.env.BANTUIN_API_URL } : {}),
});
await client.login(email, password);
let sessionId = await client.createSession("cli");
const terminal = createInterface({ input: process.stdin, output: process.stdout });

console.log("Bantuin CLI · /new · /status · /exit");
try {
  while (true) {
    const input = (await terminal.question("Anda> ")).trim();
    if (!input) continue;
    if (input === "/exit") break;
    if (input === "/new") {
      sessionId = await client.createSession("cli");
      console.log("Percakapan baru dibuat.");
      continue;
    }
    if (input === "/status") {
      console.log(JSON.stringify(await client.status(), null, 2));
      continue;
    }
    console.log(`Bantuin> ${await client.sendMessage(sessionId, input)}`);
  }
} finally {
  terminal.close();
}
