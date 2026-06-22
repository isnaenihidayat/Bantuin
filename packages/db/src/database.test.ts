import { describe, expect, test } from "bun:test";
import { createId } from "@bantuin/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDatabase, openDatabase } from "./database";
import { migrateDatabase } from "./migrations";
import {
  buildFtsQuery,
  chunkKnowledgeText,
  KnowledgeRepository,
  MemoryRepository,
  MessageRepository,
  OwnerRepository,
  ProfileRepository,
  SessionRepository,
} from "./repositories";

describe("database foundation", () => {
  test("applies migrations once and remains healthy", () => {
    const database = openDatabase("file::memory:");
    try {
      expect(migrateDatabase(database)).toEqual([1, 2, 3]);
      expect(migrateDatabase(database)).toEqual([]);
      expect(checkDatabase(database)).toBe(true);
      expect(
        database
          .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM schema_migrations")
          .get()?.count,
      ).toBe(3);
      expect(database.query<{ secure_delete: number }, []>("PRAGMA secure_delete").get()).toEqual({
        secure_delete: 1,
      });
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

  test("keeps owner-controlled memory and FTS knowledge provenance deletable", () => {
    const database = openDatabase("file::memory:");
    migrateDatabase(database);
    const now = new Date().toISOString();
    const ownerId = createId("owner");
    const profileId = createId("profile");
    const sessionId = createId("session");
    try {
      new OwnerRepository(database).create({
        id: ownerId,
        email: "memory@example.test",
        createdAt: now,
      });
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
      const exchange = new MessageRepository(database).createExchange({
        sessionId,
        userMessageId: createId("message"),
        assistantMessageId: createId("message"),
        content: "Saya suka kopi tanpa gula",
        clientRequestId: "memory-source",
        now,
      });

      const memories = new MemoryRepository(database);
      const memoryId = createId("memory");
      memories.create({
        id: memoryId,
        ownerId,
        type: "preference",
        content: "Suka kopi tanpa gula",
        sourceMessageId: exchange.user.id,
        confidence: 1,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      expect(memories.list(ownerId, "active")[0]?.content).toBe("Suka kopi tanpa gula");
      expect(
        memories.update(memoryId, ownerId, {
          type: "preference",
          content: "Suka teh tanpa gula",
          status: "archived",
          updatedAt: now,
        }),
      ).toBe(true);
      expect(memories.list(ownerId, "active")).toEqual([]);

      const knowledge = new KnowledgeRepository(database);
      const documentId = createId("document");
      const content = "Kebijakan cuti tahunan adalah dua belas hari.\n\nPengajuan melalui HR.";
      const chunks = chunkKnowledgeText(content, 40, 8).map((chunk, ordinal) => ({
        publicId: createId("chunk"),
        ordinal,
        checksum: new Bun.CryptoHasher("sha256").update(chunk).digest("hex"),
        content: chunk,
      }));
      expect(
        knowledge.createDocument(
          {
            id: documentId,
            ownerId,
            sourceName: "panduan.md",
            mediaType: "text/markdown",
            checksum: new Bun.CryptoHasher("sha256").update(content).digest("hex"),
            content,
            createdAt: now,
            updatedAt: now,
          },
          chunks,
        ),
      ).toBe(true);
      expect(buildFtsQuery('cuti OR "*')).toBe('"cuti" OR "or"');
      const sources = knowledge.search(ownerId, "berapa cuti tahunan?");
      expect(sources[0]).toMatchObject({ documentId, sourceName: "panduan.md" });
      knowledge.recordMessageSources(exchange.assistant.id, sources);
      expect(knowledge.listMessageSources(exchange.assistant.id)).toHaveLength(sources.length);
      expect(knowledge.deleteDocument(documentId, ownerId)).toBe(true);
      expect(knowledge.search(ownerId, "cuti")).toEqual([]);
      expect(knowledge.listMessageSources(exchange.assistant.id)).toEqual([]);
      knowledge.checkFtsIntegrity();

      database.query("DELETE FROM chat_messages WHERE id = ?").run(exchange.user.id);
      expect(memories.findForOwner(memoryId, ownerId)).toBeNull();
    } finally {
      database.close();
    }
  });
});
