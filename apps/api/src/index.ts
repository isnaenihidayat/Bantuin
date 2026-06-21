import { AgentService } from "@bantuin/agent";
import { loadConfig } from "@bantuin/core";
import { migrateDatabase, openDatabase } from "@bantuin/db";
import { createProvider } from "@bantuin/providers";
import { createApp } from "./app";

const config = loadConfig();
const database = openDatabase(config.databaseUrl);
migrateDatabase(database);

const provider = createProvider(config.provider);
const agent = new AgentService(provider);
const app = createApp({ config, database, agent });

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
});

console.log(`Bantuin API listening on ${server.url}`);

function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  void server.stop().finally(() => database.close());
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
