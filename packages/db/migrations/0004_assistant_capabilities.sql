PRAGMA foreign_keys = ON;

ALTER TABLE profiles ADD COLUMN archived_at TEXT;
ALTER TABLE chat_sessions ADD COLUMN parent_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL;
ALTER TABLE chat_sessions ADD COLUMN branch_message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL;
ALTER TABLE knowledge_documents ADD COLUMN profile_id TEXT REFERENCES profiles(id) ON DELETE RESTRICT;

UPDATE knowledge_documents
SET profile_id = (
  SELECT profiles.id FROM profiles
  WHERE profiles.owner_id = knowledge_documents.owner_id
  ORDER BY profiles.created_at LIMIT 1
);

UPDATE knowledge_documents SET checksum = profile_id || ':' || checksum;

CREATE UNIQUE INDEX knowledge_documents_profile_checksum
  ON knowledge_documents(profile_id, checksum);
CREATE INDEX knowledge_documents_profile_created
  ON knowledge_documents(profile_id, created_at DESC);

CREATE TRIGGER knowledge_documents_require_profile_insert
BEFORE INSERT ON knowledge_documents
WHEN NEW.profile_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'knowledge profile_id is required');
END;

CREATE TRIGGER knowledge_documents_require_profile_update
BEFORE UPDATE OF profile_id ON knowledge_documents
WHEN NEW.profile_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'knowledge profile_id is required');
END;

CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'document')),
  filename TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/markdown'
  )),
  bytes INTEGER NOT NULL CHECK (bytes BETWEEN 1 AND 5242880),
  content BLOB NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX message_attachments_message ON message_attachments(message_id);
