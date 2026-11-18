CREATE TABLE IF NOT EXISTS jobs (
  job_number TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  site_address TEXT NOT NULL DEFAULT '',
  job_type TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  expected_finish_date TEXT NOT NULL DEFAULT '',
  project_manager TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Enquiry',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_name_idx ON jobs(project_name);
