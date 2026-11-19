CREATE TABLE IF NOT EXISTS job_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_number TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, job_number)
);
CREATE INDEX IF NOT EXISTS job_assignments_job_idx ON job_assignments(job_number);

CREATE TABLE IF NOT EXISTS job_updates (
  id TEXT PRIMARY KEY,
  job_number TEXT NOT NULL,
  job_name TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  work_type TEXT NOT NULL,
  issue TEXT NOT NULL,
  next_action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  review_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS job_updates_job_created_idx ON job_updates(job_number, created_at DESC);
CREATE INDEX IF NOT EXISTS job_updates_review_created_idx ON job_updates(review_status, created_at DESC);

CREATE TABLE IF NOT EXISTS job_update_photos (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL REFERENCES job_updates(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS job_update_photos_update_idx ON job_update_photos(update_id);
