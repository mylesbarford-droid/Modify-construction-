const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 310000;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}
async function digest(value) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function body(request) {
  try { return await request.json(); } catch { return null; }
}
function clientKey(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
async function rateLimit(env, key, limit = 8) {
  const now = Math.floor(Date.now() / 1000);
  const id = await digest(key);
  await env.DB.prepare("DELETE FROM auth_attempts WHERE window_start < ?").bind(now - 900).run();
  const row = await env.DB.prepare("SELECT attempts, window_start FROM auth_attempts WHERE id = ?").bind(id).first();
  if (row && row.window_start > now - 900 && row.attempts >= limit) return false;
  if (row && row.window_start > now - 900) {
    await env.DB.prepare("UPDATE auth_attempts SET attempts = attempts + 1 WHERE id = ?").bind(id).run();
  } else {
    await env.DB.prepare("INSERT OR REPLACE INTO auth_attempts (id, attempts, window_start) VALUES (?, 1, ?)").bind(id, now).run();
  }
  return true;
}
async function getSession(request, env) {
  const token = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith("modify_session="))?.slice("modify_session=".length);
  if (!token) return null;
  const row = await env.DB.prepare("SELECT s.id, s.user_id, s.expires_at, u.full_name, u.staff_code, u.role, u.active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?").bind(await digest(token)).first();
  if (!row || row.expires_at < Math.floor(Date.now() / 1000) || !row.active) return null;
  return row;
}
const PERMISSIONS = {
  administrator: ["*"],
  office_manager: ["job_updates:read", "job_updates:create", "job_updates:review", "dashboard:read", "jobs:read", "jobs:write", "money:read", "money:write", "documents:read", "documents:write", "suppliers:read", "suppliers:write", "workforce:read", "workforce:write", "users:read"],
  site_manager: ["job_updates:read", "job_updates:create", "job_updates:review", "dashboard:read", "jobs:read", "jobs:write", "workforce:read", "workforce:write", "plant:read", "plant:write", "vehicles:read", "vehicles:write", "safety:read", "safety:write", "documents:read"],
  employee: ["job_updates:read", "job_updates:create", "dashboard:read", "jobs:assigned:read", "timesheets:read", "timesheets:write", "daily_reports:read", "daily_reports:write"]
};
function can(role, permission) {
  const grants = PERMISSIONS[role] || [];
  return grants.includes("*") || grants.includes(permission);
}
async function audit(env, session, action, detail = "") {
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)")
    .bind(session?.user_id || null, action, String(detail).slice(0, 500), Math.floor(Date.now() / 1000)).run();
}
async function handleApi(request, env) {
  if (!env.DB) return json({ error: "The shared database is not configured yet." }, 503);
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const input = await body(request);
    if (!input || typeof input.companyPassword !== "string" || typeof input.staffCode !== "string" || typeof input.pin !== "string") return json({ error: "Enter the company password, staff code and PIN." }, 400);
    if (!await rateLimit(env, clientKey(request) + ":login")) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    if (!env.COMPANY_LOGIN_PASSWORD || !safeEqual(input.companyPassword, env.COMPANY_LOGIN_PASSWORD)) {
      await audit(env, null, "login_failed", "Company login rejected");
      return json({ error: "Sign-in details are incorrect." }, 401);
    }
    const user = await env.DB.prepare("SELECT id, full_name, staff_code, role, pin_salt, pin_hash, active FROM users WHERE lower(staff_code) = lower(?)").bind(input.staffCode.trim()).first();
    if (!user || !user.active || !/^\d{6}$/.test(input.pin) || !safeEqual(await pinHash(input.pin, user.pin_salt || ""), user.pin_hash || "")) {
      await audit(env, null, "login_failed", "Personal PIN rejected");
      return json({ error: "Sign-in details are incorrect." }, 401);
    }
    const token = randomToken();
    const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(randomToken(16), user.id, await digest(token), expires, Math.floor(Date.now() / 1000)).run();
    await audit(env, { user_id: user.id }, "login", "Successful sign-in");
    return json({ user: { id: user.id, name: user.full_name, staffCode: user.staff_code, role: user.role, permissions: PERMISSIONS[user.role] || [] } }, 200, { "set-cookie": cookie("modify_session", token, SESSION_TTL_SECONDS) });
  }
  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const session = await getSession(request, env);
    if (!session) return json({ user: null }, 401, { "set-cookie": clearCookie("modify_session") });
    return json({ user: { id: session.user_id, name: session.full_name, staffCode: session.staff_code, role: session.role, permissions: PERMISSIONS[session.role] || [] } });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const session = await getSession(request, env);
    const token = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith("modify_session="))?.slice("modify_session=".length);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
    if (session) await audit(env, session, "logout");
    return json({ ok: true }, 200, { "set-cookie": clearCookie("modify_session") });
  }
  if (request.method === "POST" && url.pathname === "/api/setup/first-admin") {
    if (!env.BOOTSTRAP_KEY || !safeEqual(request.headers.get("x-bootstrap-key") || "", env.BOOTSTRAP_KEY)) return json({ error: "Not authorised." }, 403);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
    if (Number(count?.count || 0) !== 0) return json({ error: "Initial setup has already been completed." }, 409);
    const input = await body(request);
    if (!input || typeof input.name !== "string" || typeof input.staffCode !== "string" || !/^\d{6}$/.test(input.pin || "")) return json({ error: "Provide a name, staff code and six-digit PIN." }, 400);
    const salt = randomToken(16);
    await env.DB.prepare("INSERT INTO users (id, full_name, staff_code, role, pin_salt, pin_hash, active, created_at) VALUES (?, ?, ?, 'administrator', ?, ?, 1, ?)")
      .bind(randomToken(16), input.name.trim().slice(0, 100), input.staffCode.trim().slice(0, 40), salt, await pinHash(input.pin, salt), Math.floor(Date.now() / 1000)).run();
    return json({ ok: true, message: "Administrator created. Remove the BOOTSTRAP_KEY secret from the Worker now." }, 201);
  }
  const session = await getSession(request, env);
  if (!session) return json({ error: "Please sign in again." }, 401, { "set-cookie": clearCookie("modify_session") });
  if (request.method === "GET" && url.pathname === "/api/auth/users") {
    if (!can(session.role, "users:read")) return json({ error: "You do not have permission to view users." }, 403);
    const { results } = await env.DB.prepare("SELECT id, full_name AS name, staff_code AS staffCode, role, active FROM users ORDER BY full_name").all();
    return json({ users: results });
  }
  if (url.pathname === "/api/job-updates" && request.method === "GET") {
    if (!can(session.role, "job_updates:read")) return json({ error: "Not authorised." }, 403);
    let result;
    if (session.role === "employee") {
      result = await env.DB.prepare("SELECT j.*, u.full_name AS creator_name FROM job_updates j JOIN users u ON u.id=j.created_by WHERE EXISTS (SELECT 1 FROM job_assignments a WHERE a.user_id=? AND a.job_number=j.job_number) ORDER BY j.created_at DESC LIMIT 200").bind(session.user_id).all();
    } else {
      result = await env.DB.prepare("SELECT j.*, u.full_name AS creator_name FROM job_updates j JOIN users u ON u.id=j.created_by ORDER BY j.created_at DESC LIMIT 500").all();
    }
    const ids = (result.results || []).map(x => x.id);
    const photos = [];
    for (const id of ids) {
      const p = await env.DB.prepare("SELECT id, update_id, file_name, content_type, size_bytes FROM job_update_photos WHERE update_id=? ORDER BY created_at").bind(id).all();
      photos.push(...(p.results || []));
    }
    return json({ updates: (result.results || []).map(x => ({ ...x, photos: photos.filter(p => p.update_id === x.id) })) });
  }
  if (url.pathname === "/api/job-updates" && request.method === "POST") {
    if (!can(session.role, "job_updates:create")) return json({ error: "Not authorised." }, 403);
    const input = await body(request);
    const required = ["jobNumber", "stage", "status", "workType", "issue", "nextAction"];
    if (!input || required.some(k => typeof input[k] !== "string" || !input[k].trim()) || input.note !== undefined && typeof input.note !== "string") return json({ error: "Complete all required job update selections." }, 400);
    if (input.jobNumber.length > 80 || input.jobName?.length > 160 || input.note?.length > 3000) return json({ error: "One or more fields are too long." }, 400);
    if (session.role === "employee") {
      const assigned = await env.DB.prepare("SELECT 1 AS ok FROM job_assignments WHERE user_id=? AND job_number=?").bind(session.user_id, input.jobNumber).first();
      if (!assigned) return json({ error: "You can only update jobs assigned to you." }, 403);
    }
    const id = randomToken(16), now = Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO job_updates (id,job_number,job_name,stage,status,work_type,issue,next_action,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,input.jobNumber.trim(),String(input.jobName||"").slice(0,160),input.stage.trim().slice(0,80),input.status.trim().slice(0,80),input.workType.trim().slice(0,80),input.issue.trim().slice(0,120),input.nextAction.trim().slice(0,120),String(input.note||"").slice(0,3000),session.user_id,now).run();
    await audit(env, session, "job_update_created", id);
    return json({ id, reviewStatus: "pending", createdAt: now }, 201);
  }
  const approveMatch = url.pathname.match(/^\/api\/job-updates\/([a-f0-9]+)\/review$/);
  if (approveMatch && request.method === "POST") {
    if (!can(session.role, "job_updates:review")) return json({ error: "Only managers can review job updates." }, 403);
    const input = await body(request);
    if (!input || !["approved","rejected"].includes(input.decision) || input.note !== undefined && typeof input.note !== "string") return json({ error: "Choose approve or reject." }, 400);
    const update = await env.DB.prepare("SELECT id, review_status FROM job_updates WHERE id=?").bind(approveMatch[1]).first();
    if (!update) return json({ error: "Job update not found." }, 404);
    if (update.review_status !== "pending") return json({ error: "This update has already been reviewed." }, 409);
    const now = Math.floor(Date.now()/1000);
    const changed = await env.DB.prepare("UPDATE job_updates SET review_status=?, reviewed_by=?, reviewed_at=?, review_note=? WHERE id=? AND review_status='pending'")
      .bind(input.decision,session.user_id,now,String(input.note||"").slice(0,1000),update.id).run();
    if (!changed.meta?.changes) return json({ error: "This update has already been reviewed." }, 409);
    await audit(env, session, "job_update_"+input.decision, update.id);
    return json({ ok: true, reviewStatus: input.decision, reviewedAt: now });
  }
  const photoMatch = url.pathname.match(/^\/api\/job-updates\/([a-f0-9]+)\/photos$/);
  if (photoMatch && request.method === "POST") {
    if (!can(session.role, "job_updates:create")) return json({ error: "Not authorised." }, 403);
    if (!env.JOB_PHOTOS) return json({ error: "Private photo storage is not configured." }, 503);
    const update = await env.DB.prepare("SELECT id, job_number, created_by FROM job_updates WHERE id=?").bind(photoMatch[1]).first();
    if (!update) return json({ error: "Job update not found." }, 404);
    if (session.role === "employee" && update.created_by !== session.user_id) return json({ error: "You can only attach photos to your own updates." }, 403);
    const type = request.headers.get("Content-Type") || "";
    if (!["image/jpeg","image/png","image/webp"].includes(type.split(";")[0].trim().toLowerCase())) return json({ error: "Use a JPG, PNG or WebP image." }, 415);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 8*1024*1024) return json({ error: "Each photo must be 8 MB or smaller." }, 413);
    const data = await request.arrayBuffer();
    if (!data.byteLength || data.byteLength > 8*1024*1024) return json({ error: "Each photo must be between 1 byte and 8 MB." }, 413);
    const id = randomToken(16), key = "job-updates/"+update.id+"/"+id;
    await env.JOB_PHOTOS.put(key,data,{httpMetadata:{contentType:type.split(";")[0].trim().toLowerCase()}});
    const name = (request.headers.get("X-File-Name") || "site-photo").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120);
    await env.DB.prepare("INSERT INTO job_update_photos (id,update_id,object_key,file_name,content_type,size_bytes,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id,update.id,key,name,type.split(";")[0].trim().toLowerCase(),data.byteLength,session.user_id,Math.floor(Date.now()/1000)).run();
    await audit(env,session,"job_update_photo_uploaded",update.id);
    return json({ id, name, contentType:type.split(";")[0].trim().toLowerCase(), size:data.byteLength },201);
  }
  const getPhoto = url.pathname.match(/^\/api\/job-updates\/([a-f0-9]+)\/photos\/([a-f0-9]+)$/);
  if (getPhoto && request.method === "GET") {
    if (!can(session.role, "job_updates:read")) return json({ error: "Not authorised." },403);
    if (!env.JOB_PHOTOS) return json({ error: "Private photo storage is not configured." },503);
    const photo = await env.DB.prepare("SELECT p.object_key,p.content_type,p.file_name,j.job_number,j.created_by FROM job_update_photos p JOIN job_updates j ON j.id=p.update_id WHERE p.id=? AND p.update_id=?").bind(getPhoto[2],getPhoto[1]).first();
    if (!photo) return json({ error: "Photo not found." },404);
    if (session.role === "employee") {
      const assigned = await env.DB.prepare("SELECT 1 AS ok FROM job_assignments WHERE user_id=? AND job_number=?").bind(session.user_id,photo.job_number).first();
      if (!assigned) return json({ error: "Not authorised." },403);
    }
    const object = await env.JOB_PHOTOS.get(photo.object_key);
    if (!object) return json({ error: "Photo file not found." },404);
    return new Response(object.body,{headers:{"content-type":photo.content_type,"content-disposition":'inline; filename="'+photo.file_name+'"',"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }
  return json({ error: "API route not found." }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env); }
      catch (error) {
        console.error("MODIFY API error", error);
        return json({ error: "The request could not be completed." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
