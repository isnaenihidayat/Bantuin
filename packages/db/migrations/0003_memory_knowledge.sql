PRAGMA foreign_keys = ON;

CREATE TABLE memories (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('preference', 'fact', 'goal', 'note')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  source_message_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (source_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX memories_owner_status_updated
  ON memories(owner_id, status, updated_at DESC);

CREATE TABLE knowledge_documents (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('text/plain', 'text/markdown')),
  checksum TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  UNIQUE (owner_id, checksum)
);

CREATE INDEX knowledge_documents_owner_created
  ON knowledge_documents(owner_id, created_at DESC);

CREATE TABLE knowledge_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  document_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  checksum TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  UNIQUE (document_id, ordinal)
);

CREATE VIRTUAL TABLE knowledge_chunks_fts USING fts5(
  content,
  content = 'knowledge_chunks',
  content_rowid = 'id',
  tokenize = 'unicode61'
);

CREATE TRIGGER knowledge_chunks_after_insert AFTER INSERT ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER knowledge_chunks_after_delete AFTER DELETE ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, content)
  VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER knowledge_chunks_after_update AFTER UPDATE ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, content)
  VALUES ('delete', old.id, old.content);
  INSERT INTO knowledge_chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rank)
VALUES ('secure-delete', 1);

CREATE TABLE message_knowledge_sources (
  message_id TEXT NOT NULL,
  chunk_id INTEGER NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 0),
  PRIMARY KEY (message_id, chunk_id),
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (chunk_id) REFERENCES knowledge_chunks(id) ON DELETE CASCADE
);

CREATE INDEX message_knowledge_sources_message_rank
  ON message_knowledge_sources(message_id, rank);
