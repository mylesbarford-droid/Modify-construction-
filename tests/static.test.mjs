import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/shared-app.js", import.meta.url), "utf8");
const setup = await readFile(new URL("../public/setup.html", import.meta.url), "utf8");
const migration1 = await readFile(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8");
const migration2 = await readFile(new URL("../migrations/0002_job_updates.sql", import.meta.url), "utf8");
const migration3 = await readFile(new URL("../migrations/0003_jobs.sql", import.meta.url), "utf8");
const migration4 = await readFile(new URL("../migrations/0004_shared_modules.sql", import.meta.url), "utf8");

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

test("dashboard opens automatically, shared updates and first-admin setup remain available", () => {
  assert.match(app, /api\/auth\/login/);
  assert.doesNotMatch(app, /modify-login-form/);
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
  assert.match(worker, /moduleRoute/);
  assert.match(worker, /modulePermissions/);
  assert.match(worker, /job_assignments WHERE user_id=\?/);
  assert.match(app, /syncOperationalRegisters/);
  assert.match(app, /modify-shared-records-loaded/);
});

test("shared operational records take precedence over stale browser copies", () => {
  assert.match(app, /The shared database is authoritative/);
  assert.match(app, /if\(remoteIds\.has\(id\)\)continue/);
  assert.doesNotMatch(app, /byId\.set\(String\(rec\.id\),rec\)/);
});

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const manifest = await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");

test("MODIFY is installable as a PWA without caching private company data", () => {
  const appManifest = JSON.parse(manifest);
  assert.equal(appManifest.name, "MODIFY Construction Management");
  assert.equal(appManifest.display, "standalone");
  assert.ok(appManifest.icons.some(icon => icon.src === "/icons/modify.svg"));
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /serviceWorker\.register\("\/service-worker\.js"\)/);
  assert.match(html, /modify-install-app/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /MODIFY is offline/);
});

test("open company access creates an administrator session without a password", () => {
  assert.match(worker, /Owner-requested open access/);
  assert.match(worker, /MODIFY_SHARED/);
  assert.match(app, /api\/auth\/login/);
  assert.doesNotMatch(app, /name="password"/);
  assert.doesNotMatch(app, /password:f\.get\("password"\)/);
  assert.doesNotMatch(app, /name="staffCode"/);
  assert.doesNotMatch(app, /name="pin"/);
  assert.doesNotMatch(app, /modify-staff-open/);
});

test("workforce schedule is shared, job-linked and editable with role-based access", () => {
  assert.match(worker, /schedule:read/);
  assert.match(worker, /schedule:write/);
  assert.match(worker, /schedule: "schedule"/);
  assert.match(app, /async function renderWorkforceSchedule/);
  assert.match(app, /class="calendar-month-grid"/);
  assert.match(app, /People, jobs and daily assignments/);
  assert.match(app, /api\/modules\/schedule\/records/);
  assert.match(app, /Save assignment/);
  assert.match(app, /Delete/);
  assert.match(app, /calendar_assignment/);
  assert.match(app, /sch-people/);
  assert.match(app, /schedule-person/);
  assert.match(app, /schedule-weekday/);
  assert.match(app, /sch-repeat-until/);
  assert.match(app, /repeatDefault\.setDate\(repeatDefault\.getDate\(\)\+27\)/);
  assert.match(app, /Saving .* shift/);
  assert.match(app, /loadDashboardSchedule/);
  assert.match(app, /Upcoming shifts/);



  assert.match(app, /Previous/);
  assert.match(app, /calendar-today/);
  assert.match(app, /min-width:0;width:100%;table-layout:fixed/);
  assert.match(app, /content:"Mon"/);
  assert.match(app, /calendar-assignment span,#modify-schedule \.calendar-assignment small/);
});

test("documents upload to shared D1 storage and can be retrieved across devices", () => {
  assert.match(worker, /X-File-Id/);
  assert.match(worker, /application\/pdf/);
  assert.match(worker, /Each document must be between 1 byte and 8 MB/);
  assert.match(worker, /INSERT OR REPLACE INTO shared_files/);
  assert.match(worker, /SELECT file_name,content_type,data_base64 FROM shared_files/);
  assert.match(html, /async function uploadSharedDocument/);
  assert.ok(html.includes("uploadSharedDocument(file,id)"));
  assert.match(html, /X-File-Id/);
  assert.equal(html.includes("else{out.push(await saveLocalFile(file,id))}"), false);
});
test("shared workforce and job photos use existing D1 storage without paid R2 bindings", () => {
  assert.match(worker, /INSERT OR REPLACE INTO shared_files/);
  assert.match(worker, /SELECT file_name,content_type,data_base64 FROM shared_files/);
  assert.match(worker, /INSERT INTO shared_files/);
  assert.doesNotMatch(worker, /env\\.(?:FILES|JOB_PHOTOS)/);
  assert.match(html, /uploadSharedPhoto/);
  assert.match(html, /window\.saveModifyFiles=saveFiles/);
  assert.match(html, /workerPhotoUrl/);
  assert.match(html, /Team member photo/);
  assert.match(html, /data:image/);
});
\nassert.match(app, /calendar-selected-day/);\nassert.match(app, /calendar-date-heading/);\n