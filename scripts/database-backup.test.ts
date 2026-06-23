import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
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
