import { AgentService } from "@bantuin/agent";
import { loadConfig } from "@bantuin/core";
import { migrateDatabase, openDatabase } from "@bantuin/db";
import { createProvider } from "@bantuin/providers";
import { createApp } from "./app";
import { SafeActionService } from "./safe-actions";

const config = loadConfig();
const database = openDatabase(config.databaseUrl);
migrateDatabase(database);

const provider = createProvider(config.provider);
const agent = new AgentService(provider);
const safeActions = new SafeActionService(database, agent);
const app = createApp({ config, database, agent, safeActions });
safeActions.tick();
const scheduler = setInterval(() => safeActions.tick(), 30_000);

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
});

console.log(`Bantuin API listening on ${server.url}`);

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  clearInterval(scheduler);
  await safeActions.stop();
  await server.stop();
  database.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
