PRAGMA foreign_keys = ON;

CREATE TABLE owner_credentials (
  owner_id TEXT PRIMARY KEY NOT NULL,
  singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE INDEX auth_sessions_owner_id ON auth_sessions(owner_id);
CREATE INDEX auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'streaming', 'completed', 'failed', 'cancelled')),
  client_request_id TEXT,
  error_code TEXT,
  provider_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  UNIQUE (session_id, sequence),
  UNIQUE (session_id, client_request_id)
);

CREATE INDEX chat_messages_session_sequence ON chat_messages(session_id, sequence);
