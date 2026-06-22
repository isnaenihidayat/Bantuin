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
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  ownerId: string;
  profileId: string;
  channel: string;
  title: string | null;
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

  create(profile: ProfileRecord): void {
    this.#database
      .query(
        `INSERT INTO profiles(
          id, owner_id, name, system_prompt, provider_model, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profile.id,
        profile.ownerId,
        profile.name,
        profile.systemPrompt,
        profile.providerModel,
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
          created_at: string;
          updated_at: string;
        },
        [ownerId: string]
      >(
        `SELECT id, owner_id, name, system_prompt, provider_model, created_at, updated_at
         FROM profiles WHERE owner_id = ? ORDER BY created_at LIMIT 1`,
      )
      .get(ownerId);

    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          name: row.name,
          systemPrompt: row.system_prompt,
          providerModel: row.provider_model,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  update(ownerId: string, input: { name: string; systemPrompt: string; updatedAt: string }): void {
    this.#database
      .query(`UPDATE profiles SET name = ?, system_prompt = ?, updated_at = ? WHERE owner_id = ?`)
      .run(input.name, input.systemPrompt, input.updatedAt, ownerId);
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
    profile: ProfileRecord;
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

  create(session: SessionRecord): void {
    this.#database
      .query(
        `INSERT INTO chat_sessions(
          id, owner_id, profile_id, channel, title, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.ownerId,
        session.profileId,
        session.channel,
        session.title,
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
          created_at: string;
          updated_at: string;
        },
        [id: string, ownerId: string]
      >(
        `SELECT id, owner_id, profile_id, channel, title, created_at, updated_at
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
          created_at: string;
          updated_at: string;
        },
        [ownerId: string]
      >(
        `SELECT id, owner_id, profile_id, channel, title, created_at, updated_at
         FROM chat_sessions WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100`,
      )
      .all(ownerId)
      .map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        profileId: row.profile_id,
        channel: row.channel,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
