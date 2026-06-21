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
}
