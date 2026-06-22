import type { BantuinDatabase } from "./database";
import initialMigration from "../migrations/0001_initial.sql";
import coreChatMigration from "../migrations/0002_core_chat.sql";
import memoryKnowledgeMigration from "../migrations/0003_memory_knowledge.sql";

type Migration = {
  version: number;
  name: string;
  sql: string;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial",
    sql: initialMigration,
  },
  {
    version: 2,
    name: "core_chat",
    sql: coreChatMigration,
  },
  {
    version: 3,
    name: "memory_knowledge",
    sql: memoryKnowledgeMigration,
  },
];

function checksum(sql: string): string {
  return new Bun.CryptoHasher("sha256").update(sql).digest("hex");
}

export function migrateDatabase(database: BantuinDatabase): number[] {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const getApplied = database.query<{ version: number; checksum: string }, [version: number]>(
    "SELECT version, checksum FROM schema_migrations WHERE version = ?",
  );
  const insertApplied = database.query(
    "INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
  );
  const appliedNow: number[] = [];

  for (const migration of migrations) {
    const expectedChecksum = checksum(migration.sql);
    const applied = getApplied.get(migration.version);
    if (applied) {
      if (applied.checksum !== expectedChecksum) {
        throw new Error(`Migration ${migration.version} checksum mismatch`);
      }
      continue;
    }

    database.transaction(() => {
      database.exec(migration.sql);
      insertApplied.run(
        migration.version,
        migration.name,
        expectedChecksum,
        new Date().toISOString(),
      );
    })();
    appliedNow.push(migration.version);
  }

  return appliedNow;
}
