import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/shared-app.js", import.meta.url), "utf8");
const setup = await readFile(new URL("../public/setup.html", import.meta.url), "utf8");
const migration1 = await readFile(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8");
const migration2 = await readFile(new URL("../migrations/0002_job_updates.sql", import.meta.url), "utf8");
const migration3 = await readFile(new URL("../migrations/0003_jobs.sql", import.meta.url), "utf8");\nconst migration4 = await readFile(new URL("../migrations/0004_shared_modules.sql", import.meta.url), "utf8");

test("authentication endpoints and secure session cookie exist", () => {
  assert.match(worker, /\/api\/auth\/login/);
  assert.match(worker, /\/api\/auth\/me/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(worker, /PBKDF2_ITERATIONS = 310000/);
});

test("staff administration and job assignment endpoints exist", () => {
  assert.match(worker, /\/api\/auth\/users/);
  assert.match(worker, /\/api\/job-assignments/);
  assert.match(worker, /Only the administrator can create staff accounts/);
});

test("job update endpoints enforce role checks and review state", () => {
  assert.match(worker, /\/api\/job-updates/);
  assert.match(worker, /Only managers can review job updates/);
  assert.match(worker, /review_status='pending'/);
});

test("dashboard includes sign-in, shared updates and first-admin setup", () => {
  assert.match(app, /modify-login-form/);
  assert.match(app, /\/api\/job-updates/);
  assert.match(app, /Staff & assignments/);
  assert.match(setup, /\/api\/setup\/first-admin/);
});

test("D1 migrations include the required auth, assignments and update tables", () => {
  for (const table of ["users", "sessions", "auth_attempts", "audit_log"]) assert.match(migration1, new RegExp("CREATE TABLE IF NOT EXISTS " + table));
  for (const table of ["job_assignments", "job_updates", "job_update_photos"]) assert.match(migration2, new RegExp("CREATE TABLE IF NOT EXISTS " + table));
});

test("jobs are centrally stored and job updates must reference a real job", () => {
  assert.match(migration3, /CREATE TABLE IF NOT EXISTS jobs/);
  assert.ok(worker.includes('"/api/jobs"'));
  assert.match(worker, /Choose a job from the shared Jobs & Sites register/);
  assert.match(app, /Company job register/);
  assert.match(app, /Import missing jobs into shared register/);
  assert.match(app, /View job updates & site diary/);
});

test("operational registers have shared D1 storage and role-checked API routes", () => {
  assert.match(migration4, /CREATE TABLE IF NOT EXISTS module_records/);
  assert.match(worker, /\/api\/modules\//);
  assert.match(worker, /modulePermissions/);
  assert.match(worker, /job_assignments WHERE user_id=\?/);
  assert.match(app, /syncOperationalRegisters/);
  assert.match(app, /modify-shared-records-loaded/);
});
