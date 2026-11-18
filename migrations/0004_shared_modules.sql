CREATE TABLE IF NOT EXISTS module_records (
  module_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  job_number TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (module_name, record_id)
);
CREATE INDEX IF NOT EXISTS module_records_job_idx ON module_records(job_number, module_name);
CREATE INDEX IF NOT EXISTS module_records_updated_idx ON module_records(module_name, updated_at);
