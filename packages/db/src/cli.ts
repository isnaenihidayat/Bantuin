import { loadConfig } from "@bantuin/core";
import { migrateDatabase, openDatabase } from "./index";

const config = loadConfig();
const database = openDatabase(config.databaseUrl);

try {
  const applied = migrateDatabase(database);
  console.log(
    applied.length === 0 ? "Database is current." : `Applied migrations: ${applied.join(", ")}`,
  );
} finally {
  database.close();
}
