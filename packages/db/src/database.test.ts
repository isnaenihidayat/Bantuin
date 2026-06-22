import { describe, expect, test } from "bun:test";
import { createId } from "@bantuin/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDatabase, openDatabase } from "./database";
import { migrateDatabase } from "./migrations";
import {
  AttachmentRepository,
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
      expect(migrateDatabase(database)).toEqual([1, 2, 3, 4]);
      expect(migrateDatabase(database)).toEqual([]);
      expect(checkDatabase(database)).toBe(true);
      expect(
        database
          .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM schema_migrations")
          .get()?.count,
      ).toBe(4);
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
            profileId,
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
      const sources = knowledge.search(ownerId, profileId, "berapa cuti tahunan?");
      expect(sources[0]).toMatchObject({ documentId, sourceName: "panduan.md" });
      knowledge.recordMessageSources(exchange.assistant.id, sources);
      expect(knowledge.listMessageSources(exchange.assistant.id)).toHaveLength(sources.length);
      expect(knowledge.deleteDocument(documentId, ownerId, profileId)).toBe(true);
      expect(knowledge.search(ownerId, profileId, "cuti")).toEqual([]);
      expect(knowledge.listMessageSources(exchange.assistant.id)).toEqual([]);
      knowledge.checkFtsIntegrity();

      database.query("DELETE FROM chat_messages WHERE id = ?").run(exchange.user.id);
      expect(memories.findForOwner(memoryId, ownerId)).toBeNull();
    } finally {
      database.close();
    }
  });

  test("archives profiles without deleting history and branches attachments transactionally", () => {
    const database = openDatabase("file::memory:");
    migrateDatabase(database);
    const now = new Date().toISOString();
    const ownerId = createId("owner");
    const firstProfileId = createId("profile");
    const secondProfileId = createId("profile");
    const sourceSessionId = createId("session");
    try {
      new OwnerRepository(database).create({
        id: ownerId,
        email: "phase2@example.test",
        createdAt: now,
      });
      const profileRepository = new ProfileRepository(database);
      for (const [id, name] of [
        [firstProfileId, "Nia"],
        [secondProfileId, "Raka"],
      ] as const) {
        profileRepository.create({
          id,
          ownerId,
          name,
          systemPrompt: "",
          providerModel: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      const sessionRepository = new SessionRepository(database);
      sessionRepository.create({
        id: sourceSessionId,
        ownerId,
        profileId: firstProfileId,
        channel: "web",
        title: "Asal",
        createdAt: now,
        updatedAt: now,
      });
      const exchange = new MessageRepository(database).createExchange({
        sessionId: sourceSessionId,
        userMessageId: createId("message"),
        assistantMessageId: createId("message"),
        content: "Lihat gambar",
        clientRequestId: "phase2-branch",
        now,
      });
      new AttachmentRepository(database).createMany([
        {
          id: createId("attachment"),
          messageId: exchange.user.id,
          kind: "image",
          filename: "contoh.png",
          mediaType: "image/png",
          bytes: 3,
          content: new Uint8Array([1, 2, 3]),
          createdAt: now,
        },
      ]);
      const branchId = createId("session");
      expect(
        sessionRepository.branch(sourceSessionId, ownerId, exchange.user.id, {
          id: branchId,
          ownerId,
          profileId: firstProfileId,
          channel: "web",
          title: "Cabang",
          parentSessionId: sourceSessionId,
          branchMessageId: exchange.user.id,
          createdAt: now,
          updatedAt: now,
        }),
      ).toBe(true);
      const branchedMessage = new MessageRepository(database).list(branchId)[0];
      expect(branchedMessage?.content).toBe("Lihat gambar");
      if (!branchedMessage) throw new Error("Expected branched message");
      expect(new AttachmentRepository(database).list(branchedMessage.id)[0]?.bytes).toBe(3);
      expect(profileRepository.archive(firstProfileId, ownerId, now)).toBe(true);
      expect(sessionRepository.findByIdForOwner(sourceSessionId, ownerId)).not.toBeNull();
      expect(profileRepository.list(ownerId).map((profile) => profile.id)).toEqual([
        secondProfileId,
      ]);
      expect(profileRepository.archive(secondProfileId, ownerId, now)).toBe(false);
    } finally {
      database.close();
    }
  });
});
