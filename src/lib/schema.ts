export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  colour TEXT NOT NULL DEFAULT '#466CFF',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venture_id INTEGER NOT NULL REFERENCES ventures(id),
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (venture_id, name)
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  location TEXT NOT NULL,
  timezone TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_ventures (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, venture_id)
);

CREATE TABLE IF NOT EXISTS member_projects (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, project_id)
);

CREATE TABLE IF NOT EXISTS calendar_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  project_id INTEGER REFERENCES projects(id),
  status TEXT NOT NULL CHECK (status IN ('available', 'tentative', 'busy', 'leave')),
  note TEXT,
  leave_certainty TEXT CHECK (leave_certainty IN ('confirmed', 'provisional') OR leave_certainty IS NULL),
  timezone TEXT NOT NULL,
  local_start_time TEXT NOT NULL,
  local_end_time TEXT NOT NULL,
  recurrence_rule TEXT,
  recurrence_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  series_id INTEGER REFERENCES calendar_series(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id),
  status TEXT NOT NULL CHECK (status IN ('available', 'tentative', 'busy', 'leave')),
  note TEXT,
  leave_certainty TEXT CHECK (leave_certainty IN ('confirmed', 'provisional') OR leave_certainty IS NULL),
  starts_at_utc TEXT NOT NULL,
  ends_at_utc TEXT NOT NULL,
  original_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at_utc > starts_at_utc)
);

CREATE TABLE IF NOT EXISTS series_exceptions (
  series_id INTEGER NOT NULL REFERENCES calendar_series(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('deleted', 'replaced')),
  replacement_entry_id INTEGER REFERENCES calendar_entries(id),
  PRIMARY KEY (series_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_entries_member_time
  ON calendar_entries(member_id, starts_at_utc, ends_at_utc);
CREATE INDEX IF NOT EXISTS idx_entries_project_time
  ON calendar_entries(project_id, starts_at_utc, ends_at_utc);
`;
