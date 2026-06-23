PRAGMA foreign_keys = ON;

CREATE TABLE channel_sessions (
  owner_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('telegram')),
  external_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, channel, external_user_id),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE channel_inbound_messages (
  owner_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('telegram')),
  external_message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, channel, external_message_id),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE owner_usage (
  owner_id TEXT PRIMARY KEY NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  reported_cost REAL NOT NULL DEFAULT 0 CHECK (reported_cost >= 0),
  tracked_since TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);
