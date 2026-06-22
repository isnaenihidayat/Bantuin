PRAGMA foreign_keys = ON;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'failed')),
  position INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE RESTRICT
);

CREATE INDEX tasks_owner_status_position ON tasks(owner_id, status, position);

CREATE TABLE task_runs (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  lease_expires_at TEXT NOT NULL,
  output TEXT,
  error TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE RESTRICT
);

CREATE INDEX task_runs_task_started ON task_runs(task_id, started_at DESC);

CREATE TABLE automations (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule')),
  cron TEXT,
  timezone TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE RESTRICT,
  CHECK ((trigger_type = 'manual' AND cron IS NULL) OR (trigger_type = 'schedule' AND cron IS NOT NULL))
);

CREATE INDEX automations_owner_enabled ON automations(owner_id, enabled, updated_at DESC);

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY NOT NULL,
  automation_id TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  scheduled_for TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  lease_expires_at TEXT NOT NULL,
  output TEXT,
  error TEXT,
  UNIQUE (automation_id, occurrence_key),
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE RESTRICT
);

CREATE INDEX automation_runs_automation_started ON automation_runs(automation_id, started_at DESC);

CREATE TABLE action_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  session_id TEXT,
  action_name TEXT NOT NULL,
  arguments_json TEXT NOT NULL,
  arguments_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'denied', 'running', 'completed', 'failed', 'cancelled')),
  expires_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL
);

CREATE INDEX action_proposals_owner_status ON action_proposals(owner_id, status, created_at DESC);

CREATE TABLE action_events (
  id TEXT PRIMARY KEY NOT NULL,
  proposal_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('system', 'owner')),
  detail TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES action_proposals(id) ON DELETE RESTRICT
);

CREATE INDEX action_events_proposal_created ON action_events(proposal_id, created_at);

CREATE TRIGGER action_events_no_update
BEFORE UPDATE ON action_events
BEGIN
  SELECT RAISE(ABORT, 'action events are append-only');
END;

CREATE TRIGGER action_events_no_delete
BEFORE DELETE ON action_events
BEGIN
  SELECT RAISE(ABORT, 'action events are append-only');
END;

CREATE TABLE mcp_server_metadata (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled = 0),
  cached_tools_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, name),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE RESTRICT
);
