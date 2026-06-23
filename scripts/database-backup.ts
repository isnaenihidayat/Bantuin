import { Database } from "bun:sqlite";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { databasePathFromUrl } from "@bantuin/db";

const CURRENT_SCHEMA_VERSION = 6;

async function sha256(path: string): Promise<string> {
  return new Bun.CryptoHasher("sha256").update(await Bun.file(path).arrayBuffer()).digest("hex");
}

export async function backupDatabase(databaseUrl: string, directory: string) {
  const source = databasePathFromUrl(databaseUrl);
  if (source === ":memory:") throw new Error("In-memory databases cannot be backed up");
  const targetDirectory = resolve(directory);
  await mkdir(targetDirectory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const snapshot = join(targetDirectory, `bantuin-${stamp}.sqlite`);
  const database = new Database(source, { readonly: true, strict: true });
  try {
    database.query("VACUUM INTO ?").run(snapshot);
  } finally {
    database.close();
  }
  const manifest = {
    version: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    snapshot: basename(snapshot),
    bytes: (await stat(snapshot)).size,
    sha256: await sha256(snapshot),
  };
  const manifestPath = `${snapshot}.json`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { snapshot, manifestPath, manifest };
}

export async function restoreDatabase(manifestPath: string, targetDatabaseUrl: string) {
  const target = databasePathFromUrl(targetDatabaseUrl);
  if (target === ":memory:") throw new Error("Restore target must be a file");
  const raw = JSON.parse(await readFile(resolve(manifestPath), "utf8")) as Record<string, unknown>;
  if (
    raw.version !== 1 ||
    raw.schemaVersion !== CURRENT_SCHEMA_VERSION ||
    typeof raw.snapshot !== "string" ||
    basename(raw.snapshot) !== raw.snapshot ||
    typeof raw.sha256 !== "string"
  ) {
    throw new Error("Backup manifest is invalid or incompatible");
  }
  const snapshot = join(dirname(resolve(manifestPath)), raw.snapshot);
  if ((await sha256(snapshot)) !== raw.sha256) throw new Error("Backup checksum mismatch");
  const database = new Database(snapshot, { readonly: true, strict: true });
  try {
    const integrity = database
      .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
      .get();
    const schema = database
      .query<{ version: number | null }, []>(
        "SELECT MAX(version) AS version FROM schema_migrations",
      )
      .get();
    if (integrity?.integrity_check !== "ok" || schema?.version !== CURRENT_SCHEMA_VERSION) {
      throw new Error("Backup database failed integrity or schema validation");
    }
  } finally {
    database.close();
  }
  await mkdir(resolve(target, ".."), { recursive: true });
  await copyFile(snapshot, target, constants.COPYFILE_EXCL);
  return target;
}

if (import.meta.main) {
  const [command, first, second] = process.argv.slice(2);
  if (command === "backup") {
    const result = await backupDatabase(
      process.env.DATABASE_URL ?? "file:data/bantuin.sqlite",
      first ?? "backups",
    );
    console.log(result.manifestPath);
  } else if (command === "restore" && first && second) {
    console.log(await restoreDatabase(first, second));
  } else {
    throw new Error("Usage: backup [directory] | restore <manifest.json> <new-file:database-url>");
  }
}
