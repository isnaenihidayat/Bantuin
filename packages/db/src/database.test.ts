import { describe, expect, test } from "bun:test";
import { createId } from "@bantuin/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDatabase, openDatabase } from "./database";
import { migrateDatabase } from "./migrations";
import {
  MessageRepository,
  OwnerRepository,
  ProfileRepository,
  SessionRepository,
} from "./repositories";

describe("database foundation", () => {
  test("applies migrations once and remains healthy", () => {
    const database = openDatabase("file::memory:");
    try {
      expect(migrateDatabase(database)).toEqual([1, 2]);
      expect(migrateDatabase(database)).toEqual([]);
      expect(checkDatabase(database)).toBe(true);
      expect(
        database
          .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM schema_migrations")
          .get()?.count,
      ).toBe(2);
    } finally {
      database.close();
    }
  });

  test("persists the minimal owner, profile, and session graph", () => {
    const database = openDatabase("file::memory:");
    migrateDatabase(database);
    const now = new Date().toISOString();
    const ownerId = createId("owner");
    const profileId = createId("profile");
    const sessionId = createId("session");

    try {
      const owners = new OwnerRepository(database);
      owners.create({ id: ownerId, email: "owner@example.test", createdAt: now });
      new ProfileRepository(database).create({
        id: profileId,
        ownerId,
        name: "Bantuin",
        systemPrompt: "",
        providerModel: null,
        createdAt: now,
        updatedAt: now,
      });
      new SessionRepository(database).create({
        id: sessionId,
        ownerId,
        profileId,
        channel: "web",
        title: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(owners.findById(ownerId)).toEqual({
        id: ownerId,
        email: "owner@example.test",
        createdAt: now,
      });
      expect(
        database.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM chat_sessions").get()
          ?.count,
      ).toBe(1);
    } finally {
      database.close();
    }
  });

  test("recovers interrupted assistant messages after restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "bantuin-restart-"));
    const databaseUrl = `file:${join(directory, "bantuin.sqlite")}`;
    const now = new Date().toISOString();
    const ownerId = createId("owner");
    const profileId = createId("profile");
    const sessionId = createId("session");
    const first = openDatabase(databaseUrl);

    try {
      migrateDatabase(first);
      new OwnerRepository(first).create({
        id: ownerId,
        email: "owner@example.test",
        createdAt: now,
      });
      new ProfileRepository(first).create({
        id: profileId,
        ownerId,
        name: "Bantuin",
        systemPrompt: "",
        providerModel: null,
        createdAt: now,
        updatedAt: now,
      });
      new SessionRepository(first).create({
        id: sessionId,
        ownerId,
        profileId,
        channel: "web",
        title: null,
        createdAt: now,
        updatedAt: now,
      });
      new MessageRepository(first).createExchange({
        sessionId,
        userMessageId: createId("message"),
        assistantMessageId: createId("message"),
        content: "Halo",
        clientRequestId: "restart-request",
        now,
      });
    } finally {
      first.close();
    }

    const restarted = openDatabase(databaseUrl);
    try {
      migrateDatabase(restarted);
      const messages = new MessageRepository(restarted);
      expect(messages.reconcileInterrupted(new Date().toISOString())).toBe(1);
      expect(messages.list(sessionId)[1]).toMatchObject({
        role: "assistant",
        status: "failed",
        errorCode: "STREAM_INTERRUPTED",
      });
    } finally {
      restarted.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
