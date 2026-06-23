import { createId } from "@bantuin/core";
import type { BantuinDatabase } from "./database";

export type OwnerRecord = {
  id: string;
  email: string;
  createdAt: string;
};

export type ProfileRecord = {
  id: string;
  ownerId: string;
  name: string;
  systemPrompt: string;
  providerModel: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  ownerId: string;
  profileId: string;
  channel: string;
  title: string | null;
  parentSessionId: string | null;
  branchMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageStatus = "pending" | "streaming" | "completed" | "failed" | "cancelled";

export type MessageRecord = {
  id: string;
  sessionId: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  clientRequestId: string | null;
  errorCode: string | null;
  providerRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttachmentRecord = {
  id: string;
  messageId: string;
  kind: "image" | "document";
  filename: string | null;
  mediaType:
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp"
    | "text/plain"
    | "text/markdown";
  bytes: number;
  content: Uint8Array;
  createdAt: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  client_request_id: string | null;
  error_code: string | null;
  provider_request_id: string | null;
  created_at: string;
  updated_at: string;
};

function toMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,
    role: row.role,
    content: row.content,
    status: row.status,
    clientRequestId: row.client_request_id,
    errorCode: row.error_code,
    providerRequestId: row.provider_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class OwnerRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  create(owner: OwnerRecord): void {
    this.#database
      .query("INSERT INTO owners(id, email, created_at) VALUES (?, ?, ?)")
      .run(owner.id, owner.email, owner.createdAt);
  }

  findById(id: string): OwnerRecord | null {
    const row = this.#database
      .query<{ id: string; email: string; created_at: string }, [id: string]>(
        "SELECT id, email, created_at FROM owners WHERE id = ?",
      )
      .get(id);

    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  }

  findByEmail(email: string): OwnerRecord | null {
    const row = this.#database
      .query<{ id: string; email: string; created_at: string }, [email: string]>(
        "SELECT id, email, created_at FROM owners WHERE email = ?",
      )
      .get(email);

    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  }
}

export class ProfileRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  create(profile: Omit<ProfileRecord, "archivedAt"> & { archivedAt?: string | null }): void {
    this.#database
      .query(
        `INSERT INTO profiles(
          id, owner_id, name, system_prompt, provider_model, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profile.id,
        profile.ownerId,
        profile.name,
        profile.systemPrompt,
        profile.providerModel,
        profile.archivedAt ?? null,
        profile.createdAt,
        profile.updatedAt,
      );
  }

  findByOwnerId(ownerId: string): ProfileRecord | null {
    const row = this.#database
      .query<
        {
          id: string;
          owner_id: string;
          name: string;
          system_prompt: string;
          provider_model: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        },
        [ownerId: string]
      >(
        `SELECT id, owner_id, name, system_prompt, provider_model, archived_at, created_at, updated_at
         FROM profiles WHERE owner_id = ? AND archived_at IS NULL ORDER BY created_at LIMIT 1`,
      )
      .get(ownerId);

    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          name: row.name,
          systemPrompt: row.system_prompt,
          providerModel: row.provider_model,
          archivedAt: row.archived_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  findByIdForOwner(id: string, ownerId: string): ProfileRecord | null {
    return this.list(ownerId, true).find((profile) => profile.id === id) ?? null;
  }

  findById(id: string): ProfileRecord | null {
    const row = this.#database
      .query<
        {
          id: string;
          owner_id: string;
          name: string;
          system_prompt: string;
          provider_model: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        },
        [string]
      >(
        `SELECT id, owner_id, name, system_prompt, provider_model, archived_at, created_at, updated_at
         FROM profiles WHERE id = ?`,
      )
      .get(id);
    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          name: row.name,
          systemPrompt: row.system_prompt,
          providerModel: row.provider_model,
          archivedAt: row.archived_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  list(ownerId: string, includeArchived = false): ProfileRecord[] {
    return this.#database
      .query<
        {
          id: string;
          owner_id: string;
          name: string;
          system_prompt: string;
          provider_model: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        },
        [ownerId: string]
      >(
        `SELECT id, owner_id, name, system_prompt, provider_model, archived_at, created_at, updated_at
         FROM profiles WHERE owner_id = ? ${includeArchived ? "" : "AND archived_at IS NULL"}
         ORDER BY created_at`,
      )
      .all(ownerId)
      .map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        systemPrompt: row.system_prompt,
        providerModel: row.provider_model,
        archivedAt: row.archived_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  update(
    id: string,
    ownerId: string,
    input: { name: string; systemPrompt: string; providerModel: string | null; updatedAt: string },
  ): boolean {
    this.#database
      .query(
        `UPDATE profiles SET name = ?, system_prompt = ?, provider_model = ?, updated_at = ?
         WHERE id = ? AND owner_id = ? AND archived_at IS NULL`,
      )
      .run(input.name, input.systemPrompt, input.providerModel, input.updatedAt, id, ownerId);
    return Boolean(this.findByIdForOwner(id, ownerId)?.archivedAt === null);
  }

  archive(id: string, ownerId: string, archivedAt: string): boolean {
    if (this.list(ownerId).length <= 1) return false;
    return (
      Number(
        this.#database
          .query(
            `UPDATE profiles SET archived_at = ?, updated_at = ?
             WHERE id = ? AND owner_id = ? AND archived_at IS NULL`,
          )
          .run(archivedAt, archivedAt, id, ownerId).changes,
      ) === 1
    );
  }
}

export type AuthenticatedOwner = OwnerRecord & { passwordHash: string };

export class AuthRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  isSetupComplete(): boolean {
    return Boolean(this.#database.query("SELECT 1 FROM owners LIMIT 1").get());
  }

  createSetup(input: {
    owner: OwnerRecord;
    profile: Omit<ProfileRecord, "archivedAt"> & { archivedAt?: string | null };
    passwordHash: string;
  }): boolean {
    return this.#database
      .transaction(() => {
        if (this.isSetupComplete()) return false;

        new OwnerRepository(this.#database).create(input.owner);
        new ProfileRepository(this.#database).create(input.profile);
        this.#database
          .query(
            `INSERT INTO owner_credentials(owner_id, password_hash, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(input.owner.id, input.passwordHash, input.owner.createdAt, input.owner.createdAt);
        return true;
      })
      .immediate();
  }

  findCredentialsByEmail(email: string): AuthenticatedOwner | null {
    const row = this.#database
      .query<
        { id: string; email: string; created_at: string; password_hash: string },
        [email: string]
      >(
        `SELECT owners.id, owners.email, owners.created_at, owner_credentials.password_hash
         FROM owners
         JOIN owner_credentials ON owner_credentials.owner_id = owners.id
         WHERE owners.email = ?`,
      )
      .get(email);

    return row
      ? {
          id: row.id,
          email: row.email,
          createdAt: row.created_at,
          passwordHash: row.password_hash,
        }
      : null;
  }

  createSession(input: {
    tokenHash: string;
    ownerId: string;
    createdAt: string;
    expiresAt: string;
  }): void {
    this.#database
      .query(
        `INSERT INTO auth_sessions(token_hash, owner_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.tokenHash, input.ownerId, input.createdAt, input.expiresAt);
  }

  findOwnerBySession(tokenHash: string, now: string): OwnerRecord | null {
    const row = this.#database
      .query<{ id: string; email: string; created_at: string }, [tokenHash: string, now: string]>(
        `SELECT owners.id, owners.email, owners.created_at
         FROM auth_sessions
         JOIN owners ON owners.id = auth_sessions.owner_id
         WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?`,
      )
      .get(tokenHash, now);

    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  }

  deleteSession(tokenHash: string): void {
    this.#database.query("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
  }
}

export class SessionRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  create(
    session: Omit<SessionRecord, "parentSessionId" | "branchMessageId"> & {
      parentSessionId?: string | null;
      branchMessageId?: string | null;
    },
  ): void {
    this.#database
      .query(
        `INSERT INTO chat_sessions(
          id, owner_id, profile_id, channel, title, parent_session_id, branch_message_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.ownerId,
        session.profileId,
        session.channel,
        session.title,
        session.parentSessionId ?? null,
        session.branchMessageId ?? null,
        session.createdAt,
        session.updatedAt,
      );
  }

  findByIdForOwner(id: string, ownerId: string): SessionRecord | null {
    const row = this.#database
      .query<
        {
          id: string;
          owner_id: string;
          profile_id: string;
          channel: string;
          title: string | null;
          parent_session_id: string | null;
          branch_message_id: string | null;
          created_at: string;
          updated_at: string;
        },
        [id: string, ownerId: string]
      >(
        `SELECT id, owner_id, profile_id, channel, title, parent_session_id, branch_message_id,
                created_at, updated_at
         FROM chat_sessions WHERE id = ? AND owner_id = ?`,
      )
      .get(id, ownerId);

    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          profileId: row.profile_id,
          channel: row.channel,
          title: row.title,
          parentSessionId: row.parent_session_id,
          branchMessageId: row.branch_message_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  listForOwner(ownerId: string): SessionRecord[] {
    return this.#database
      .query<
        {
          id: string;
          owner_id: string;
          profile_id: string;
          channel: string;
          title: string | null;
          parent_session_id: string | null;
          branch_message_id: string | null;
          created_at: string;
          updated_at: string;
        },
        [ownerId: string]
      >(
        `SELECT id, owner_id, profile_id, channel, title, parent_session_id, branch_message_id,
                created_at, updated_at
         FROM chat_sessions WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100`,
      )
      .all(ownerId)
      .map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        profileId: row.profile_id,
        channel: row.channel,
        title: row.title,
        parentSessionId: row.parent_session_id,
        branchMessageId: row.branch_message_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  updateTitle(id: string, ownerId: string, title: string, updatedAt: string): boolean {
    return (
      Number(
        this.#database
          .query("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
          .run(title, updatedAt, id, ownerId).changes,
      ) === 1
    );
  }

  branch(sourceId: string, ownerId: string, checkpointId: string, target: SessionRecord): boolean {
    return this.#database
      .transaction(() => {
        const source = this.findByIdForOwner(sourceId, ownerId);
        if (!source || source.profileId !== target.profileId) return false;
        const checkpoint = this.#database
          .query<{ sequence: number }, [checkpointId: string, sourceId: string]>(
            "SELECT sequence FROM chat_messages WHERE id = ? AND session_id = ? AND status = 'completed'",
          )
          .get(checkpointId, sourceId);
        if (!checkpoint) return false;
        this.create(target);
        const rows = this.#database
          .query<MessageRow, [sourceId: string, sequence: number]>(
            `SELECT id, session_id, sequence, role, content, status, client_request_id,
                    error_code, provider_request_id, created_at, updated_at
             FROM chat_messages WHERE session_id = ? AND sequence <= ? ORDER BY sequence`,
          )
          .all(sourceId, checkpoint.sequence);
        const insertMessage = this.#database.query(
          `INSERT INTO chat_messages(
             id, session_id, sequence, role, content, status, client_request_id,
             error_code, provider_request_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        );
        const insertAttachment = this.#database.query(
          `INSERT INTO message_attachments(
             id, message_id, kind, filename, media_type, bytes, content, created_at
           ) SELECT ?, ?, kind, filename, media_type, bytes, content, created_at
             FROM message_attachments WHERE id = ?`,
        );
        for (const row of rows) {
          const messageId = createId("message");
          insertMessage.run(
            messageId,
            target.id,
            row.sequence,
            row.role,
            row.content,
            row.status,
            row.error_code,
            row.provider_request_id,
            row.created_at,
            row.updated_at,
          );
          const attachments = this.#database
            .query<{ id: string }, [messageId: string]>(
              "SELECT id FROM message_attachments WHERE message_id = ?",
            )
            .all(row.id);
          for (const attachment of attachments) {
            insertAttachment.run(createId("attachment"), messageId, attachment.id);
          }
        }
        return true;
      })
      .immediate();
  }
}

export class AttachmentRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  createMany(attachments: AttachmentRecord[]): void {
    const insert = this.#database.query(
      `INSERT INTO message_attachments(
         id, message_id, kind, filename, media_type, bytes, content, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.#database.transaction(() => {
      for (const item of attachments) {
        insert.run(
          item.id,
          item.messageId,
          item.kind,
          item.filename,
          item.mediaType,
          item.bytes,
          item.content,
          item.createdAt,
        );
      }
    })();
  }

  list(messageId: string): AttachmentRecord[] {
    return this.#database
      .query<
        {
          id: string;
          message_id: string;
          kind: "image" | "document";
          filename: string | null;
          media_type: AttachmentRecord["mediaType"];
          bytes: number;
          content: Uint8Array;
          created_at: string;
        },
        [messageId: string]
      >(
        `SELECT id, message_id, kind, filename, media_type, bytes, content, created_at
         FROM message_attachments WHERE message_id = ? ORDER BY created_at, id`,
      )
      .all(messageId)
      .map((row) => ({
        id: row.id,
        messageId: row.message_id,
        kind: row.kind,
        filename: row.filename,
        mediaType: row.media_type,
        bytes: row.bytes,
        content: row.content,
        createdAt: row.created_at,
      }));
  }
}

export class MessageRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  list(sessionId: string): MessageRecord[] {
    return this.#database
      .query<MessageRow, [sessionId: string]>(
        `SELECT id, session_id, sequence, role, content, status, client_request_id,
                error_code, provider_request_id, created_at, updated_at
         FROM chat_messages WHERE session_id = ? ORDER BY sequence`,
      )
      .all(sessionId)
      .map(toMessage);
  }

  findForOwner(id: string, ownerId: string): MessageRecord | null {
    const row = this.#database
      .query<MessageRow, [id: string, ownerId: string]>(
        `SELECT chat_messages.id, chat_messages.session_id, chat_messages.sequence,
                chat_messages.role, chat_messages.content, chat_messages.status,
                chat_messages.client_request_id, chat_messages.error_code,
                chat_messages.provider_request_id, chat_messages.created_at,
                chat_messages.updated_at
         FROM chat_messages
         JOIN chat_sessions ON chat_sessions.id = chat_messages.session_id
         WHERE chat_messages.id = ? AND chat_sessions.owner_id = ?`,
      )
      .get(id, ownerId);
    return row ? toMessage(row) : null;
  }

  createExchange(input: {
    sessionId: string;
    userMessageId: string;
    assistantMessageId: string;
    content: string;
    clientRequestId: string;
    now: string;
  }): { user: MessageRecord; assistant: MessageRecord; created: boolean } {
    return this.#database
      .transaction(() => {
        const existing = this.#database
          .query<MessageRow, [sessionId: string, clientRequestId: string]>(
            `SELECT id, session_id, sequence, role, content, status, client_request_id,
                    error_code, provider_request_id, created_at, updated_at
             FROM chat_messages WHERE session_id = ? AND client_request_id = ?`,
          )
          .get(input.sessionId, input.clientRequestId);
        if (existing) {
          const assistant = this.#database
            .query<MessageRow, [sessionId: string, sequence: number]>(
              `SELECT id, session_id, sequence, role, content, status, client_request_id,
                      error_code, provider_request_id, created_at, updated_at
               FROM chat_messages WHERE session_id = ? AND sequence = ?`,
            )
            .get(input.sessionId, existing.sequence + 1);
          if (!assistant) throw new Error("Duplicate exchange is missing its assistant message");
          return { user: toMessage(existing), assistant: toMessage(assistant), created: false };
        }

        const nextSequence =
          this.#database
            .query<{ value: number }, [sessionId: string]>(
              "SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM chat_messages WHERE session_id = ?",
            )
            .get(input.sessionId)?.value ?? 1;
        const insert = this.#database.query(
          `INSERT INTO chat_messages(
             id, session_id, sequence, role, content, status, client_request_id,
             error_code, provider_request_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
        );
        insert.run(
          input.userMessageId,
          input.sessionId,
          nextSequence,
          "user",
          input.content,
          "completed",
          input.clientRequestId,
          input.now,
          input.now,
        );
        insert.run(
          input.assistantMessageId,
          input.sessionId,
          nextSequence + 1,
          "assistant",
          "",
          "pending",
          null,
          input.now,
          input.now,
        );
        this.#database
          .query("UPDATE chat_sessions SET updated_at = ? WHERE id = ?")
          .run(input.now, input.sessionId);

        const [user, assistant] = this.list(input.sessionId).slice(-2);
        if (!user || !assistant) throw new Error("Created exchange could not be loaded");
        return { user, assistant, created: true };
      })
      .immediate();
  }

  createRetry(input: {
    sessionId: string;
    assistantMessageId: string;
    clientRequestId: string;
    now: string;
  }): { assistant: MessageRecord; created: boolean } {
    return this.#database
      .transaction(() => {
        const existing = this.#database
          .query<MessageRow, [sessionId: string, clientRequestId: string]>(
            `SELECT id, session_id, sequence, role, content, status, client_request_id,
                    error_code, provider_request_id, created_at, updated_at
             FROM chat_messages
             WHERE session_id = ? AND client_request_id = ? AND role = 'assistant'`,
          )
          .get(input.sessionId, input.clientRequestId);
        if (existing) return { assistant: toMessage(existing), created: false };

        const nextSequence =
          this.#database
            .query<{ value: number }, [sessionId: string]>(
              "SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM chat_messages WHERE session_id = ?",
            )
            .get(input.sessionId)?.value ?? 1;
        this.#database
          .query(
            `INSERT INTO chat_messages(
               id, session_id, sequence, role, content, status, client_request_id,
               error_code, provider_request_id, created_at, updated_at
             ) VALUES (?, ?, ?, 'assistant', '', 'pending', ?, NULL, NULL, ?, ?)`,
          )
          .run(
            input.assistantMessageId,
            input.sessionId,
            nextSequence,
            input.clientRequestId,
            input.now,
            input.now,
          );
        const assistant = this.findForSession(input.assistantMessageId, input.sessionId);
        if (!assistant) throw new Error("Created retry could not be loaded");
        return { assistant, created: true };
      })
      .immediate();
  }

  findForSession(id: string, sessionId: string): MessageRecord | null {
    const row = this.#database
      .query<MessageRow, [id: string, sessionId: string]>(
        `SELECT id, session_id, sequence, role, content, status, client_request_id,
                error_code, provider_request_id, created_at, updated_at
         FROM chat_messages WHERE id = ? AND session_id = ?`,
      )
      .get(id, sessionId);
    return row ? toMessage(row) : null;
  }

  appendDelta(id: string, delta: string, updatedAt: string): void {
    this.#database
      .query(
        `UPDATE chat_messages
         SET content = content || ?, status = 'streaming', updated_at = ?
         WHERE id = ? AND status IN ('pending', 'streaming')`,
      )
      .run(delta, updatedAt, id);
  }

  finish(
    id: string,
    status: Extract<MessageStatus, "completed" | "failed" | "cancelled">,
    updatedAt: string,
    metadata: { errorCode?: string; providerRequestId?: string } = {},
  ): void {
    this.#database
      .query(
        `UPDATE chat_messages
         SET status = ?, error_code = ?, provider_request_id = ?, updated_at = ?
         WHERE id = ? AND status IN ('pending', 'streaming')`,
      )
      .run(status, metadata.errorCode ?? null, metadata.providerRequestId ?? null, updatedAt, id);
  }

  reconcileInterrupted(updatedAt: string): number {
    return Number(
      this.#database
        .query(
          `UPDATE chat_messages
           SET status = 'failed', error_code = 'STREAM_INTERRUPTED', updated_at = ?
           WHERE status IN ('pending', 'streaming')`,
        )
        .run(updatedAt).changes,
    );
  }
}

export type MemoryType = "preference" | "fact" | "goal" | "note";
export type MemoryStatus = "active" | "archived";

export type MemoryRecord = {
  id: string;
  ownerId: string;
  type: MemoryType;
  content: string;
  sourceMessageId: string | null;
  confidence: number;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
};

type MemoryRow = {
  id: string;
  owner_id: string;
  type: MemoryType;
  content: string;
  source_message_id: string | null;
  confidence: number;
  status: MemoryStatus;
  created_at: string;
  updated_at: string;
};

function toMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    type: row.type,
    content: row.content,
    sourceMessageId: row.source_message_id,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const memorySelect = `SELECT id, owner_id, type, content, source_message_id, confidence,
                             status, created_at, updated_at
                      FROM memories`;

export class MemoryRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  create(memory: MemoryRecord): void {
    this.#database
      .query(
        `INSERT INTO memories(
           id, owner_id, type, content, source_message_id, confidence, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        memory.id,
        memory.ownerId,
        memory.type,
        memory.content,
        memory.sourceMessageId,
        memory.confidence,
        memory.status,
        memory.createdAt,
        memory.updatedAt,
      );
  }

  list(ownerId: string, status?: MemoryStatus): MemoryRecord[] {
    const rows = status
      ? this.#database
          .query<MemoryRow, [ownerId: string, status: MemoryStatus]>(
            `${memorySelect} WHERE owner_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 200`,
          )
          .all(ownerId, status)
      : this.#database
          .query<MemoryRow, [ownerId: string]>(
            `${memorySelect} WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200`,
          )
          .all(ownerId);
    return rows.map(toMemory);
  }

  findForOwner(id: string, ownerId: string): MemoryRecord | null {
    const row = this.#database
      .query<MemoryRow, [id: string, ownerId: string]>(
        `${memorySelect} WHERE id = ? AND owner_id = ?`,
      )
      .get(id, ownerId);
    return row ? toMemory(row) : null;
  }

  update(
    id: string,
    ownerId: string,
    input: { type: MemoryType; content: string; status: MemoryStatus; updatedAt: string },
  ): boolean {
    return (
      Number(
        this.#database
          .query(
            `UPDATE memories SET type = ?, content = ?, status = ?, updated_at = ?
             WHERE id = ? AND owner_id = ?`,
          )
          .run(input.type, input.content, input.status, input.updatedAt, id, ownerId).changes,
      ) === 1
    );
  }

  delete(id: string, ownerId: string): boolean {
    return (
      Number(
        this.#database.query("DELETE FROM memories WHERE id = ? AND owner_id = ?").run(id, ownerId)
          .changes,
      ) === 1
    );
  }
}

export type KnowledgeDocumentRecord = {
  id: string;
  ownerId: string;
  profileId: string;
  sourceName: string;
  mediaType: "text/plain" | "text/markdown";
  checksum: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunkInput = {
  publicId: string;
  ordinal: number;
  checksum: string;
  content: string;
};

export type KnowledgeSource = {
  id: number;
  chunkId: string;
  documentId: string;
  sourceName: string;
  ordinal: number;
  content: string;
  score: number;
};

export function buildFtsQuery(text: string): string | null {
  const terms = text
    .normalize("NFKC")
    .toLocaleLowerCase("id")
    .match(/[\p{L}\p{N}]{2,}/gu)
    ?.slice(0, 8);
  if (!terms?.length) return null;
  return [...new Set(terms)].map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
}

export function chunkKnowledgeText(content: string, target = 1_200, overlap = 160): string[] {
  const text = content.replaceAll("\r\n", "\n").trim();
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end);
      if (boundary > start + target * 0.6) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export class KnowledgeRepository {
  readonly #database: BantuinDatabase;

  constructor(database: BantuinDatabase) {
    this.#database = database;
  }

  createDocument(document: KnowledgeDocumentRecord, chunks: KnowledgeChunkInput[]): boolean {
    const scopedChecksum = `${document.profileId}:${document.checksum}`;
    return this.#database
      .transaction(() => {
        const duplicate = this.#database
          .query<{ id: string }, [profileId: string, checksum: string]>(
            "SELECT id FROM knowledge_documents WHERE profile_id = ? AND checksum = ?",
          )
          .get(document.profileId, scopedChecksum);
        if (duplicate) return false;

        this.#database
          .query(
            `INSERT INTO knowledge_documents(
               id, owner_id, profile_id, source_name, media_type, checksum, content, created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            document.id,
            document.ownerId,
            document.profileId,
            document.sourceName,
            document.mediaType,
            scopedChecksum,
            document.content,
            document.createdAt,
            document.updatedAt,
          );
        const insertChunk = this.#database.query(
          `INSERT INTO knowledge_chunks(public_id, document_id, ordinal, checksum, content)
           VALUES (?, ?, ?, ?, ?)`,
        );
        for (const chunk of chunks) {
          insertChunk.run(
            chunk.publicId,
            document.id,
            chunk.ordinal,
            chunk.checksum,
            chunk.content,
          );
        }
        return true;
      })
      .immediate();
  }

  listDocuments(ownerId: string, profileId: string): KnowledgeDocumentRecord[] {
    return this.#database
      .query<
        {
          id: string;
          owner_id: string;
          profile_id: string;
          source_name: string;
          media_type: "text/plain" | "text/markdown";
          checksum: string;
          content: string;
          created_at: string;
          updated_at: string;
        },
        [ownerId: string, profileId: string]
      >(
        `SELECT id, owner_id, profile_id, source_name, media_type, checksum, content, created_at,
                updated_at
         FROM knowledge_documents WHERE owner_id = ? AND profile_id = ?
         ORDER BY created_at DESC LIMIT 200`,
      )
      .all(ownerId, profileId)
      .map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        profileId: row.profile_id,
        sourceName: row.source_name,
        mediaType: row.media_type,
        checksum: row.checksum.startsWith(`${row.profile_id}:`)
          ? row.checksum.slice(row.profile_id.length + 1)
          : row.checksum,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  search(ownerId: string, profileId: string, text: string, limit = 5): KnowledgeSource[] {
    const query = buildFtsQuery(text);
    if (!query) return [];
    return this.#database
      .query<
        {
          id: number;
          public_id: string;
          document_id: string;
          source_name: string;
          ordinal: number;
          content: string;
          score: number;
        },
        [query: string, ownerId: string, profileId: string, limit: number]
      >(
        `SELECT knowledge_chunks.id, knowledge_chunks.public_id,
                knowledge_chunks.document_id, knowledge_documents.source_name,
                knowledge_chunks.ordinal, knowledge_chunks.content,
                bm25(knowledge_chunks_fts) AS score
         FROM knowledge_chunks_fts
         JOIN knowledge_chunks ON knowledge_chunks.id = knowledge_chunks_fts.rowid
         JOIN knowledge_documents ON knowledge_documents.id = knowledge_chunks.document_id
         WHERE knowledge_chunks_fts MATCH ? AND knowledge_documents.owner_id = ?
           AND knowledge_documents.profile_id = ?
         ORDER BY score LIMIT ?`,
      )
      .all(query, ownerId, profileId, limit)
      .map((row) => ({
        id: row.id,
        chunkId: row.public_id,
        documentId: row.document_id,
        sourceName: row.source_name,
        ordinal: row.ordinal,
        content: row.content,
        score: row.score,
      }));
  }

  recordMessageSources(messageId: string, sources: KnowledgeSource[]): void {
    this.#database.transaction(() => {
      this.#database
        .query("DELETE FROM message_knowledge_sources WHERE message_id = ?")
        .run(messageId);
      const insert = this.#database.query(
        `INSERT INTO message_knowledge_sources(message_id, chunk_id, rank)
         VALUES (?, ?, ?)`,
      );
      sources.forEach((source, rank) => {
        insert.run(messageId, source.id, rank);
      });
    })();
  }

  listMessageSources(messageId: string): KnowledgeSource[] {
    return this.#database
      .query<
        {
          id: number;
          public_id: string;
          document_id: string;
          source_name: string;
          ordinal: number;
          content: string;
          rank: number;
        },
        [messageId: string]
      >(
        `SELECT knowledge_chunks.id, knowledge_chunks.public_id,
                knowledge_chunks.document_id, knowledge_documents.source_name,
                knowledge_chunks.ordinal, knowledge_chunks.content,
                message_knowledge_sources.rank
         FROM message_knowledge_sources
         JOIN knowledge_chunks ON knowledge_chunks.id = message_knowledge_sources.chunk_id
         JOIN knowledge_documents ON knowledge_documents.id = knowledge_chunks.document_id
         WHERE message_knowledge_sources.message_id = ?
         ORDER BY message_knowledge_sources.rank`,
      )
      .all(messageId)
      .map((row) => ({
        id: row.id,
        chunkId: row.public_id,
        documentId: row.document_id,
        sourceName: row.source_name,
        ordinal: row.ordinal,
        content: row.content,
        score: row.rank,
      }));
  }

  deleteDocument(id: string, ownerId: string, profileId: string): boolean {
    const owned = this.#database
      .query<{ value: number }, [id: string, ownerId: string, profileId: string]>(
        "SELECT 1 AS value FROM knowledge_documents WHERE id = ? AND owner_id = ? AND profile_id = ?",
      )
      .get(id, ownerId, profileId);
    if (!owned) return false;
    this.#database
      .query("DELETE FROM knowledge_documents WHERE id = ? AND owner_id = ? AND profile_id = ?")
      .run(id, ownerId, profileId);
    return !this.#database
      .query<{ value: number }, [id: string]>(
        "SELECT 1 AS value FROM knowledge_documents WHERE id = ?",
      )
      .get(id);
  }

  checkFtsIntegrity(): void {
    this.#database.exec(
      "INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rank) VALUES ('integrity-check', 1)",
    );
  }
}

export type WorkStatus = "backlog" | "todo" | "in_progress" | "done" | "failed";
export type RunStatus = "running" | "completed" | "failed" | "cancelled";

export type TaskRecord = {
  id: string;
  ownerId: string;
  profileId: string;
  title: string;
  description: string;
  prompt: string;
  status: WorkStatus;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunRecord = {
  id: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  leaseExpiresAt: string;
  output: string | null;
  error: string | null;
};

function toTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    profileId: String(row.profile_id),
    title: String(row.title),
    description: String(row.description),
    prompt: String(row.prompt),
    status: row.status as WorkStatus,
    position: Number(row.position),
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toRun(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id),
    status: row.status as RunStatus,
    startedAt: String(row.started_at),
    completedAt: (row.completed_at as string | null) ?? null,
    leaseExpiresAt: String(row.lease_expires_at),
    output: (row.output as string | null) ?? null,
    error: (row.error as string | null) ?? null,
  };
}

export class TaskRepository {
  constructor(readonly database: BantuinDatabase) {}

  create(task: TaskRecord): void {
    this.database
      .query(
        `INSERT INTO tasks(id, owner_id, profile_id, title, description, prompt, status, position,
                           archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.ownerId,
        task.profileId,
        task.title,
        task.description,
        task.prompt,
        task.status,
        task.position,
        task.archivedAt,
        task.createdAt,
        task.updatedAt,
      );
  }

  list(ownerId: string): TaskRecord[] {
    return this.database
      .query<Record<string, unknown>, [string]>(
        `SELECT * FROM tasks WHERE owner_id = ? AND archived_at IS NULL
         ORDER BY status, position, created_at`,
      )
      .all(ownerId)
      .map(toTask);
  }

  find(id: string, ownerId: string): TaskRecord | null {
    const row = this.database
      .query<Record<string, unknown>, [string, string]>(
        "SELECT * FROM tasks WHERE id = ? AND owner_id = ? AND archived_at IS NULL",
      )
      .get(id, ownerId);
    return row ? toTask(row) : null;
  }

  update(task: TaskRecord): boolean {
    return (
      Number(
        this.database
          .query(
            `UPDATE tasks SET profile_id = ?, title = ?, description = ?, prompt = ?, status = ?,
                              position = ?, updated_at = ?
             WHERE id = ? AND owner_id = ? AND archived_at IS NULL`,
          )
          .run(
            task.profileId,
            task.title,
            task.description,
            task.prompt,
            task.status,
            task.position,
            task.updatedAt,
            task.id,
            task.ownerId,
          ).changes,
      ) === 1
    );
  }

  archive(id: string, ownerId: string, now: string): boolean {
    return (
      Number(
        this.database
          .query(
            "UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND archived_at IS NULL",
          )
          .run(now, now, id, ownerId).changes,
      ) === 1
    );
  }

  createRun(taskId: string, run: RunRecord): boolean {
    const active = this.database
      .query<{ value: number }, [string]>(
        "SELECT 1 AS value FROM task_runs WHERE task_id = ? AND status = 'running'",
      )
      .get(taskId);
    if (active) return false;
    this.database
      .query(
        `INSERT INTO task_runs(id, task_id, status, started_at, completed_at, lease_expires_at, output, error)
         VALUES (?, ?, 'running', ?, NULL, ?, NULL, NULL)`,
      )
      .run(run.id, taskId, run.startedAt, run.leaseExpiresAt);
    return true;
  }

  listRuns(taskId: string, ownerId: string): RunRecord[] {
    return this.database
      .query<Record<string, unknown>, [string, string]>(
        `SELECT task_runs.* FROM task_runs JOIN tasks ON tasks.id = task_runs.task_id
         WHERE task_id = ? AND tasks.owner_id = ? ORDER BY started_at DESC LIMIT 50`,
      )
      .all(taskId, ownerId)
      .map(toRun);
  }

  finishRun(
    id: string,
    status: Exclude<RunStatus, "running">,
    now: string,
    output: string | null,
    error: string | null,
  ): boolean {
    return (
      Number(
        this.database
          .query(
            `UPDATE task_runs SET status = ?, completed_at = ?, output = ?, error = ?
       WHERE id = ? AND status = 'running'`,
          )
          .run(status, now, output, error, id).changes,
      ) === 1
    );
  }

  recoverExpired(now: string): number {
    return Number(
      this.database
        .query(
          `UPDATE task_runs SET status = 'failed', completed_at = ?, error = 'RUN_LEASE_EXPIRED'
       WHERE status = 'running' AND lease_expires_at <= ?`,
        )
        .run(now, now).changes,
    );
  }
}

export type AutomationRecord = {
  id: string;
  ownerId: string;
  profileId: string;
  name: string;
  prompt: string;
  triggerType: "manual" | "schedule";
  cron: string | null;
  timezone: string;
  enabled: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toAutomation(row: Record<string, unknown>): AutomationRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    profileId: String(row.profile_id),
    name: String(row.name),
    prompt: String(row.prompt),
    triggerType: row.trigger_type as "manual" | "schedule",
    cron: (row.cron as string | null) ?? null,
    timezone: String(row.timezone),
    enabled: Boolean(row.enabled),
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class AutomationRepository {
  constructor(readonly database: BantuinDatabase) {}

  create(item: AutomationRecord): void {
    this.database
      .query(
        `INSERT INTO automations(id, owner_id, profile_id, name, prompt, trigger_type, cron, timezone,
                               enabled, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        item.id,
        item.ownerId,
        item.profileId,
        item.name,
        item.prompt,
        item.triggerType,
        item.cron,
        item.timezone,
        item.enabled ? 1 : 0,
        item.archivedAt,
        item.createdAt,
        item.updatedAt,
      );
  }

  list(ownerId: string): AutomationRecord[] {
    return this.database
      .query<Record<string, unknown>, [string]>(
        "SELECT * FROM automations WHERE owner_id = ? AND archived_at IS NULL ORDER BY updated_at DESC",
      )
      .all(ownerId)
      .map(toAutomation);
  }

  listScheduled(): AutomationRecord[] {
    return this.database
      .query<Record<string, unknown>, []>(
        `SELECT * FROM automations WHERE enabled = 1 AND trigger_type = 'schedule'
         AND archived_at IS NULL ORDER BY updated_at`,
      )
      .all()
      .map(toAutomation);
  }

  find(id: string, ownerId: string): AutomationRecord | null {
    const row = this.database
      .query<Record<string, unknown>, [string, string]>(
        "SELECT * FROM automations WHERE id = ? AND owner_id = ? AND archived_at IS NULL",
      )
      .get(id, ownerId);
    return row ? toAutomation(row) : null;
  }

  update(item: AutomationRecord): boolean {
    return (
      Number(
        this.database
          .query(
            `UPDATE automations SET profile_id = ?, name = ?, prompt = ?, trigger_type = ?, cron = ?,
                              timezone = ?, enabled = ?, updated_at = ?
       WHERE id = ? AND owner_id = ? AND archived_at IS NULL`,
          )
          .run(
            item.profileId,
            item.name,
            item.prompt,
            item.triggerType,
            item.cron,
            item.timezone,
            item.enabled ? 1 : 0,
            item.updatedAt,
            item.id,
            item.ownerId,
          ).changes,
      ) === 1
    );
  }

  archive(id: string, ownerId: string, now: string): boolean {
    return (
      Number(
        this.database
          .query(
            "UPDATE automations SET archived_at = ?, enabled = 0, updated_at = ? WHERE id = ? AND owner_id = ? AND archived_at IS NULL",
          )
          .run(now, now, id, ownerId).changes,
      ) === 1
    );
  }

  claimRun(
    automationId: string,
    occurrenceKey: string,
    scheduledFor: string | null,
    run: RunRecord,
  ): boolean {
    try {
      return this.database
        .transaction(() => {
          const active = this.database
            .query<{ value: number }, [string]>(
              "SELECT 1 AS value FROM automation_runs WHERE automation_id = ? AND status = 'running'",
            )
            .get(automationId);
          if (active) return false;
          this.database
            .query(
              `INSERT INTO automation_runs(id, automation_id, occurrence_key, scheduled_for, status,
                                           started_at, completed_at, lease_expires_at, output, error)
               VALUES (?, ?, ?, ?, 'running', ?, NULL, ?, NULL, NULL)`,
            )
            .run(
              run.id,
              automationId,
              occurrenceKey,
              scheduledFor,
              run.startedAt,
              run.leaseExpiresAt,
            );
          return true;
        })
        .immediate();
    } catch (error) {
      if (String(error).includes("UNIQUE constraint failed")) return false;
      throw error;
    }
  }

  listRuns(automationId: string, ownerId: string): RunRecord[] {
    return this.database
      .query<Record<string, unknown>, [string, string]>(
        `SELECT automation_runs.* FROM automation_runs JOIN automations ON automations.id = automation_runs.automation_id
       WHERE automation_id = ? AND automations.owner_id = ? ORDER BY started_at DESC LIMIT 50`,
      )
      .all(automationId, ownerId)
      .map(toRun);
  }

  finishRun(
    id: string,
    status: Exclude<RunStatus, "running">,
    now: string,
    output: string | null,
    error: string | null,
  ): boolean {
    return (
      Number(
        this.database
          .query(
            `UPDATE automation_runs SET status = ?, completed_at = ?, output = ?, error = ?
       WHERE id = ? AND status = 'running'`,
          )
          .run(status, now, output, error, id).changes,
      ) === 1
    );
  }

  recoverExpired(now: string): number {
    return Number(
      this.database
        .query(
          `UPDATE automation_runs SET status = 'failed', completed_at = ?, error = 'RUN_LEASE_EXPIRED'
       WHERE status = 'running' AND lease_expires_at <= ?`,
        )
        .run(now, now).changes,
    );
  }
}

export type ActionStatus =
  | "proposed"
  | "approved"
  | "denied"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

function redactActionArguments(value: string): string {
  return value
    .replaceAll(
      /("(?:api[_-]?key|password|token|authorization)"\s*:\s*)"[^"]*"/giu,
      '$1"[REDACTED]"',
    )
    .replaceAll(/(bearer\s+)[a-z0-9._~+/-]+/giu, "$1[REDACTED]");
}

export class ActionRepository {
  constructor(readonly database: BantuinDatabase) {}

  create(input: {
    id: string;
    ownerId: string;
    profileId: string;
    sessionId: string | null;
    actionName: string;
    argumentsJson: string;
    argumentsHash: string;
    expiresAt: string;
    now: string;
    eventId: string;
  }): void {
    this.database.transaction(() => {
      this.database
        .query(
          `INSERT INTO action_proposals(id, owner_id, profile_id, session_id, action_name, arguments_json,
          arguments_hash, status, expires_at, decided_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', ?, NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.ownerId,
          input.profileId,
          input.sessionId,
          input.actionName,
          redactActionArguments(input.argumentsJson),
          input.argumentsHash,
          input.expiresAt,
          input.now,
          input.now,
        );
      this.database
        .query(
          "INSERT INTO action_events(id, proposal_id, event_type, actor, detail, created_at) VALUES (?, ?, 'proposed', 'system', NULL, ?)",
        )
        .run(input.eventId, input.id, input.now);
    })();
  }

  decide(
    id: string,
    ownerId: string,
    decision: "approved" | "denied",
    now: string,
    eventId: string,
  ): boolean {
    return this.database.transaction(() => {
      const changed = Number(
        this.database
          .query(
            `UPDATE action_proposals SET status = ?, decided_at = ?, updated_at = ?
         WHERE id = ? AND owner_id = ? AND status = 'proposed' AND expires_at > ?`,
          )
          .run(decision, now, now, id, ownerId, now).changes,
      );
      if (!changed) return false;
      this.database
        .query(
          "INSERT INTO action_events(id, proposal_id, event_type, actor, detail, created_at) VALUES (?, ?, ?, 'owner', NULL, ?)",
        )
        .run(eventId, id, decision, now);
      return true;
    })();
  }

  list(ownerId: string): Array<Record<string, unknown>> {
    return this.database
      .query<Record<string, unknown>, [string]>(
        `SELECT id, profile_id AS profileId, session_id AS sessionId, action_name AS actionName,
              arguments_json AS argumentsJson, arguments_hash AS argumentsHash, status,
              expires_at AS expiresAt, decided_at AS decidedAt, created_at AS createdAt,
              updated_at AS updatedAt
       FROM action_proposals WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .all(ownerId);
  }

  listEvents(id: string, ownerId: string): Array<Record<string, unknown>> {
    return this.database
      .query<Record<string, unknown>, [string, string]>(
        `SELECT action_events.id, event_type AS eventType, actor, detail, action_events.created_at AS createdAt
       FROM action_events JOIN action_proposals ON action_proposals.id = action_events.proposal_id
       WHERE proposal_id = ? AND action_proposals.owner_id = ? ORDER BY action_events.created_at`,
      )
      .all(id, ownerId);
  }
}

export class McpMetadataRepository {
  constructor(readonly database: BantuinDatabase) {}
  create(input: {
    id: string;
    ownerId: string;
    profileId: string;
    name: string;
    url: string;
    cachedToolsJson: string;
    now: string;
  }): void {
    this.database
      .query(
        `INSERT INTO mcp_server_metadata(id, owner_id, profile_id, name, url, enabled, cached_tools_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.ownerId,
        input.profileId,
        input.name,
        input.url,
        input.cachedToolsJson,
        input.now,
        input.now,
      );
  }
  list(ownerId: string): Array<Record<string, unknown>> {
    return this.database
      .query<Record<string, unknown>, [string]>(
        `SELECT id, profile_id AS profileId, name, url, enabled, cached_tools_json AS cachedToolsJson,
              created_at AS createdAt, updated_at AS updatedAt
       FROM mcp_server_metadata WHERE owner_id = ? ORDER BY name`,
      )
      .all(ownerId);
  }
}

export class ChannelRepository {
  constructor(readonly database: BantuinDatabase) {}

  claim(input: {
    ownerId: string;
    profileId: string;
    channel: "telegram";
    externalUserId: string;
    externalMessageId: string;
    sessionId: string;
    now: string;
  }): { sessionId: string; duplicate: boolean } {
    return this.database
      .transaction(() => {
        const duplicate = this.database
          .query<{ session_id: string }, [string, string, string]>(
            `SELECT session_id FROM channel_inbound_messages
             WHERE owner_id = ? AND channel = ? AND external_message_id = ?`,
          )
          .get(input.ownerId, input.channel, input.externalMessageId);
        if (duplicate) return { sessionId: duplicate.session_id, duplicate: true };

        const mapped = this.database
          .query<{ session_id: string }, [string, string, string]>(
            `SELECT session_id FROM channel_sessions
             WHERE owner_id = ? AND channel = ? AND external_user_id = ?`,
          )
          .get(input.ownerId, input.channel, input.externalUserId);
        const sessionId = mapped?.session_id ?? input.sessionId;

        if (!mapped) {
          this.database
            .query(
              `INSERT INTO chat_sessions(
                 id, owner_id, profile_id, channel, title, parent_session_id, branch_message_id,
                 created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
            )
            .run(
              sessionId,
              input.ownerId,
              input.profileId,
              input.channel,
              "Telegram",
              input.now,
              input.now,
            );
          this.database
            .query(
              `INSERT INTO channel_sessions(owner_id, channel, external_user_id, session_id, created_at)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .run(input.ownerId, input.channel, input.externalUserId, sessionId, input.now);
        }

        this.database
          .query(
            `INSERT INTO channel_inbound_messages(
               owner_id, channel, external_message_id, session_id, created_at
             ) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(input.ownerId, input.channel, input.externalMessageId, sessionId, input.now);
        return { sessionId, duplicate: false };
      })
      .immediate();
  }
}

export type UsageRecord = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reportedCost: number;
  trackedSince: string | null;
  updatedAt: string | null;
};

export class UsageRepository {
  constructor(readonly database: BantuinDatabase) {}

  record(
    ownerId: string,
    usage: { inputTokens: number; outputTokens: number; reportedCost?: number },
    now: string,
  ): void {
    this.database
      .query(
        `INSERT INTO owner_usage(
           owner_id, request_count, input_tokens, output_tokens, reported_cost, tracked_since, updated_at
         ) VALUES (?, 1, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_id) DO UPDATE SET
           request_count = request_count + 1,
           input_tokens = input_tokens + excluded.input_tokens,
           output_tokens = output_tokens + excluded.output_tokens,
           reported_cost = reported_cost + excluded.reported_cost,
           updated_at = excluded.updated_at`,
      )
      .run(ownerId, usage.inputTokens, usage.outputTokens, usage.reportedCost ?? 0, now, now);
  }

  get(ownerId: string): UsageRecord {
    const row = this.database
      .query<
        {
          request_count: number;
          input_tokens: number;
          output_tokens: number;
          reported_cost: number;
          tracked_since: string;
          updated_at: string;
        },
        [string]
      >(
        `SELECT request_count, input_tokens, output_tokens, reported_cost, tracked_since, updated_at
         FROM owner_usage WHERE owner_id = ?`,
      )
      .get(ownerId);
    return {
      requestCount: row?.request_count ?? 0,
      inputTokens: row?.input_tokens ?? 0,
      outputTokens: row?.output_tokens ?? 0,
      totalTokens: (row?.input_tokens ?? 0) + (row?.output_tokens ?? 0),
      reportedCost: row?.reported_cost ?? 0,
      trackedSince: row?.tracked_since ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  }
}
