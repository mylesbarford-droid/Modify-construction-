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
  office_manager: ["dashboard:read", "jobs:read", "jobs:write", "money:read", "money:write", "documents:read", "documents:write", "suppliers:read", "suppliers:write", "workforce:read", "workforce:write", "users:read"],
  site_manager: ["dashboard:read", "jobs:read", "jobs:write", "workforce:read", "workforce:write", "plant:read", "plant:write", "vehicles:read", "vehicles:write", "safety:read", "safety:write", "documents:read"],
  employee: ["dashboard:read", "jobs:assigned:read", "timesheets:read", "timesheets:write", "daily_reports:read", "daily_reports:write"]
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
