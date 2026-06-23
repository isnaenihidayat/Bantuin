import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrateDatabase, openDatabase } from "@bantuin/db";
import { backupDatabase, restoreDatabase } from "./database-backup";

let directory = "";
afterEach(async () => directory && rm(directory, { recursive: true, force: true }));

test("backup creates a verified snapshot and restore refuses overwrite", async () => {
  directory = await mkdtemp(join(tmpdir(), "bantuin-backup-"));
  const source = join(directory, "source.sqlite");
  const database = openDatabase(`file:${source}`);
  migrateDatabase(database);
  database.close();

  const backup = await backupDatabase(`file:${source}`, join(directory, "backups"));
  const restored = join(directory, "restored.sqlite");
  expect(await restoreDatabase(backup.manifestPath, `file:${restored}`)).toBe(restored);
  await expect(restoreDatabase(backup.manifestPath, `file:${restored}`)).rejects.toThrow();
});

test("restoring a backup from an older schema version upgrades it in place", async () => {
  directory = await mkdtemp(join(tmpdir(), "bantuin-backup-upgrade-"));
  const source = join(directory, "source.sqlite");
  const database = openDatabase(`file:${source}`);
  migrateDatabase(database);
  // Roll the snapshot back to schema v5 by undoing the v6 migration, simulating a
  // backup taken before the latest migration shipped.
  database.exec(
    "DROP TABLE channel_sessions; DROP TABLE channel_inbound_messages; DROP TABLE owner_usage;",
  );
  database.query("DELETE FROM schema_migrations WHERE version = 6").run();
  database.close();

  const backup = await backupDatabase(`file:${source}`, join(directory, "backups"));
  const manifest = JSON.parse(await readFile(backup.manifestPath, "utf8")) as Record<
    string,
    unknown
  >;
  expect(manifest.schemaVersion).toBe(5);

  const restored = join(directory, "restored.sqlite");
  await restoreDatabase(backup.manifestPath, `file:${restored}`);

  const upgraded = openDatabase(`file:${restored}`);
  const version = upgraded
    .query<{ version: number | null }, []>("SELECT MAX(version) AS version FROM schema_migrations")
    .get();
  expect(version?.version).toBe(6);
  expect(
    upgraded
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'channel_sessions'",
      )
      .get()?.name,
  ).toBe("channel_sessions");
  upgraded.close();
});

test("restore rejects a backup newer than the running schema version", async () => {
  directory = await mkdtemp(join(tmpdir(), "bantuin-backup-future-"));
  const source = join(directory, "source.sqlite");
  const database = openDatabase(`file:${source}`);
  migrateDatabase(database);
  database.close();

  const backup = await backupDatabase(`file:${source}`, join(directory, "backups"));
  const manifest = JSON.parse(await readFile(backup.manifestPath, "utf8")) as Record<
    string,
    unknown
  >;
  manifest.schemaVersion = 99;
  await writeFile(backup.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const restored = join(directory, "restored.sqlite");
  await expect(restoreDatabase(backup.manifestPath, `file:${restored}`)).rejects.toThrow();
});
