import { Database } from "bun:sqlite";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { AppError } from "@bantuin/core";

export type BantuinDatabase = Database;

export function databasePathFromUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new AppError({
      code: "CONFIG_INVALID",
      message: "DATABASE_URL must use the file: scheme",
      status: 500,
    });
  }

  const path = databaseUrl.slice("file:".length);
  if (!path) {
    throw new AppError({
      code: "CONFIG_INVALID",
      message: "DATABASE_URL must include a path",
      status: 500,
    });
  }

  return path === ":memory:" ? path : resolve(path);
}

export function openDatabase(databaseUrl: string): BantuinDatabase {
  const path = databasePathFromUrl(databaseUrl);
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  try {
    const database = new Database(path, { create: true, strict: true });
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA secure_delete = ON;");
    if (path !== ":memory:") {
      database.exec("PRAGMA journal_mode = WAL;");
    }
    return database;
  } catch (error) {
    throw new AppError({
      code: "DATABASE_UNAVAILABLE",
      message: "Unable to open the Bantuin database",
      status: 503,
      cause: error,
    });
  }
}

export function checkDatabase(database: BantuinDatabase): boolean {
  try {
    return database.query<{ value: number }, []>("SELECT 1 AS value").get()?.value === 1;
  } catch {
    return false;
  }
}
