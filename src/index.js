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
  if (!row || row.expires_at < Math.floor(Date.now() / 1000) || !row.active || row.staff_code === "MODIFY_SHARED") return null;
  return row;
}
const PERMISSIONS = {
  administrator: ["*"],
  office_manager: ["job_updates:read", "job_updates:create", "job_updates:review", "dashboard:read", "jobs:read", "jobs:write", "money:read", "money:write", "documents:read", "documents:write", "suppliers:read", "suppliers:write", "workforce:read", "workforce:write", "schedule:read", "schedule:write", "users:read"],
  site_manager: ["job_updates:read", "job_updates:create", "job_updates:review", "dashboard:read", "jobs:read", "jobs:write", "workforce:read", "workforce:write", "schedule:read", "schedule:write", "plant:read", "plant:write", "vehicles:read", "vehicles:write", "safety:read", "safety:write", "documents:read"],
  employee: ["job_updates:read", "dashboard:read", "jobs:read", "money:read", "documents:read", "suppliers:read", "workforce:read", "schedule:read", "plant:read", "vehicles:read", "safety:read", "timesheets:read", "daily_reports:read"]
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
  if (request.method === "GET" && url.pathname === "/api/auth/roster") {
    const rows = await env.DB.prepare("SELECT payload FROM module_records WHERE module_name='workforce' ORDER BY updated_at DESC LIMIT 1000").all();
    const names = new Set(["Jay Wilson", "Dave Hawes"]);
    for (const row of rows.results || []) {
      try {
        const p = JSON.parse(row.payload);
        const name = String(p["Full name"] || p.fullName || p.name || "").trim();
        if (name && name.length <= 100) names.add(name);
      } catch {}
    }
    return json({ names: [...names].sort((a,b)=>a.localeCompare(b)) });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const input = await body(request);
    const name = String(input?.name || "").trim().replace(/\\s+/g," ");
    if (!name || name.length > 100) return json({error:"Choose your name to continue."},400);
    const normalized = name.toLocaleLowerCase("en-GB");
    const isJay = normalized === "jay wilson", isDave = normalized === "dave hawes";
    let role = "employee", staffCode = "VIEWER_" + (await digest(normalized)).slice(0,32);
    let salt = randomToken(16), hash = randomToken(32);
    if (isJay || isDave) {
      if (!await rateLimit(env, clientKey(request)+":manager:"+normalized, 6)) return json({error:"Too many PIN attempts. Try again in 15 minutes."},429);
      const manager = isJay
        ? {salt:"bbc5583a5003aff96bf22c21f918f7ee",hash:"1d00c25c02a0281d202ae2ad1d0c09902a4e16042be7d112025abcb1b7ce3f8e"}
        : {salt:"77c5d1b0549d0e09dc0c5543e1b9cc6a",hash:"45afa5e17cb9e0f477833763f43a45471cf13afc1de270e223208982f3f8e1b7"};
      if (typeof input.pin !== "string" || !safeEqual(await pinHash(input.pin,manager.salt),manager.hash)) return json({error:"That PIN is not correct."},401);
      role = "administrator"; staffCode = isJay ? "JAY_WILSON" : "DAVE_HAWES"; salt=manager.salt; hash=manager.hash;
    } else {
      const rows = await env.DB.prepare("SELECT payload FROM module_records WHERE module_name='workforce'").all();
      const valid = (rows.results||[]).some(row => { try { const p=JSON.parse(row.payload); return String(p["Full name"]||p.fullName||p.name||"").trim().toLocaleLowerCase("en-GB")===normalized; } catch { return false; }});
      if (!valid) return json({error:"That name is not in the Workforce list yet. Ask a manager to add you."},404);
    }
    let user = await env.DB.prepare("SELECT id,full_name,staff_code,role,active FROM users WHERE staff_code=?").bind(staffCode).first();
    const now=Math.floor(Date.now()/1000);
    if (!user) {
      const id=randomToken(16);
      await env.DB.prepare("INSERT INTO users (id,full_name,staff_code,role,pin_salt,pin_hash,active,created_at) VALUES (?,?,?,?,?,?,1,?)").bind(id,isJay?"Jay Wilson":isDave?"Dave Hawes":name,staffCode,role,salt,hash,now).run();
      user={id,full_name:name,staff_code:staffCode,role,active:1};
    } else {
      await env.DB.prepare("UPDATE users SET full_name=?,role=?,active=1 WHERE id=?").bind(isJay?"Jay Wilson":isDave?"Dave Hawes":name,role,user.id).run();
      user.full_name=isJay?"Jay Wilson":isDave?"Dave Hawes":name;user.role=role;user.active=1;
    }
    const token=randomToken(),expires=now+SESSION_TTL_SECONDS;
    await env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(randomToken(16),user.id,await digest(token),expires,now).run();
    await audit(env,{user_id:user.id},"named_login",role+":"+user.full_name);
    return json({user:{id:user.id,name:user.full_name,staffCode:user.staff_code,role:user.role,permissions:PERMISSIONS[user.role]||[]}},200,{"set-cookie":cookie("modify_session",token,SESSION_TTL_SECONDS)});
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
  // Shared workforce images are stored in the existing D1 database.
  if (request.method === "POST" && url.pathname === "/api/files") {
    const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (contentType === "application/json") {
      const input = await body(request);
      if (!input || typeof input.id !== "string" || !/^[a-f0-9]{32}$/.test(input.id) || typeof input.data !== "string") return json({ error: "Invalid photo upload." }, 400);
      const match = input.data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match || match[2].length > 480000) return json({ error: "Use a JPG, PNG or WebP image up to 350 KB." }, 413);
      const name = String(input.name || "profile-photo.jpg").replace(/[\\/\r\n\0"]/g, "_").slice(0, 180) || "profile-photo.jpg";
      const size = Math.floor(match[2].length * 3 / 4);
      if (!size || size > 350000) return json({ error: "Photo must be 350 KB or smaller." }, 413);
      await env.DB.prepare("INSERT OR REPLACE INTO shared_files (id,file_name,content_type,data_base64,size_bytes,created_at) VALUES (?,?,?,?,?,?)")
        .bind(input.id,name,match[1],match[2],size,new Date().toISOString()).run();
      await audit(env, session, "shared_file_uploaded", input.id + ":" + name);
      return json({ id: input.id, name, type: match[1], size }, 201);
    }
    const id = request.headers.get("X-File-Id") || "";
    if (!/^[a-f0-9]{32}$/.test(id)) return json({ error: "Invalid file ID." }, 400);
    if (!["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","text/plain","text/csv","image/jpeg","image/png","image/webp"].includes(contentType)) return json({ error: "Use PDF, Word, Excel, PowerPoint, CSV, text, JPG, PNG or WebP files." }, 415);
    const data = await request.arrayBuffer();
    if (!data.byteLength || data.byteLength > 8 * 1024 * 1024) return json({ error: "Each document must be between 1 byte and 8 MB." }, 413);
    const raw = new Uint8Array(data);
    let binary = "";
    for (let offset=0; offset<raw.length; offset+=0x8000) binary += String.fromCharCode(...raw.subarray(offset, Math.min(offset+0x8000,raw.length)));
    const encoded = btoa(binary);
    let name = request.headers.get("X-File-Name") || "document";
    try { name = decodeURIComponent(name); } catch {}
    name = String(name).replace(/[\\/\r\n\0"]/g, "_").slice(0,180) || "document";
    await env.DB.prepare("INSERT OR REPLACE INTO shared_files (id,file_name,content_type,data_base64,size_bytes,created_at) VALUES (?,?,?,?,?,?)")
      .bind(id,name,contentType,encoded,data.byteLength,new Date().toISOString()).run();
    await audit(env, session, "shared_file_uploaded", id + ":" + name);
    return json({ id, name, type: contentType, size: data.byteLength }, 201);
  }
  const sharedFile = url.pathname.match(/^\/api\/files\/([a-f0-9]{32})$/);
  if (sharedFile && request.method === "GET") {
    const file = await env.DB.prepare("SELECT file_name,content_type,data_base64 FROM shared_files WHERE id=?").bind(sharedFile[1]).first();
    if (!file) return json({ error: "File not found." }, 404);
    const binary = atob(file.data_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return new Response(bytes, { headers: {
      "content-type": file.content_type,
      "content-disposition": 'inline; filename="' + file.file_name.replace(/["\\]/g, "_") + '"',
      "x-file-name": encodeURIComponent(file.file_name),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }});
  }

  if (request.method === "POST" && url.pathname === "/api/auth/users") {
    if (session.role !== "administrator") return json({ error: "Only the administrator can create staff accounts." }, 403);
    const input = await body(request);
    const roles = ["office_manager", "site_manager", "employee"];
    if (!input || typeof input.name !== "string" || typeof input.staffCode !== "string" || !/^\d{6}$/.test(input.pin || "") || !roles.includes(input.role)) return json({ error: "Enter a name, staff code, six-digit PIN and valid role." }, 400);
    const name = input.name.trim().slice(0, 100), staffCode = input.staffCode.trim().slice(0, 40);
    if (!name || !/^[a-zA-Z0-9_-]{2,40}$/.test(staffCode)) return json({ error: "Use a staff code with 2–40 letters, numbers, hyphens or underscores." }, 400);
    const existing = await env.DB.prepare("SELECT 1 FROM users WHERE lower(staff_code)=lower(?)").bind(staffCode).first();
    if (existing) return json({ error: "That staff code is already in use." }, 409);
    const salt = randomToken(16), id = randomToken(16), now = Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO users (id,full_name,staff_code,role,pin_salt,pin_hash,active,created_at) VALUES (?,?,?,?,?,?,1,?)")
      .bind(id,name,staffCode,input.role,salt,await pinHash(input.pin,salt),now).run();
    await audit(env,session,"staff_created",staffCode+":"+input.role);
    return json({ user: { id, name, staffCode, role: input.role, active: 1 } },201);
  }
  if (request.method === "PATCH" && url.pathname.startsWith("/api/auth/users/")) {
    if (session.role !== "administrator") return json({ error: "Only the administrator can change staff accounts." }, 403);
    const userId = url.pathname.slice("/api/auth/users/".length);
    if (!/^[a-f0-9]{32}$/.test(userId)) return json({ error: "Invalid staff account." },400);
    if (userId === session.user_id) return json({ error: "You cannot deactivate your own account." },400);
    const input = await body(request);
    if (!input || typeof input.active !== "boolean") return json({ error: "Choose whether the account is active." },400);
    const result = await env.DB.prepare("UPDATE users SET active=? WHERE id=?").bind(input.active?1:0,userId).run();
    if (!result.meta?.changes) return json({ error: "Staff account not found." },404);
    if (!input.active) await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId).run();
    await audit(env,session,input.active?"staff_activated":"staff_deactivated",userId);
    return json({ok:true});
  }
  if (url.pathname === "/api/job-assignments" && request.method === "GET") {
    if (!["administrator","office_manager","site_manager","employee"].includes(session.role)) return json({error:"Not authorised."},403);
    const rows = await env.DB.prepare("SELECT a.user_id,a.job_number,u.full_name,u.staff_code FROM job_assignments a JOIN users u ON u.id=a.user_id ORDER BY a.job_number,u.full_name").all();
    return json({assignments:rows.results||[]});
  }
  if (url.pathname === "/api/job-assignments" && request.method === "POST") {
    if (session.role !== "administrator" && session.role !== "office_manager") return json({error:"Only an administrator or office manager can assign jobs."},403);
    const input = await body(request);
    if (!input || typeof input.userId !== "string" || typeof input.jobNumber !== "string" || !input.jobNumber.trim()) return json({error:"Choose a staff member and enter a job number."},400);
    const user = await env.DB.prepare("SELECT id,role FROM users WHERE id=? AND active=1").bind(input.userId).first();
    if (!user || user.role !== "employee") return json({error:"Choose an active employee account."},400);
    const jobNumber=input.jobNumber.trim().slice(0,80);
    const jobExists=await env.DB.prepare("SELECT 1 AS ok FROM jobs WHERE job_number=?").bind(jobNumber).first();
    if(!jobExists)return json({error:"Create the job in Jobs & Sites before assigning staff."},400);
    await env.DB.prepare("INSERT OR IGNORE INTO job_assignments (user_id,job_number,created_at) VALUES (?,?,?)").bind(user.id,jobNumber,Math.floor(Date.now()/1000)).run();
    await audit(env,session,"job_assigned",user.id+":"+jobNumber);
    return json({ok:true},201);
  }
  if (url.pathname.startsWith("/api/job-assignments/") && request.method === "DELETE") {
    if (session.role !== "administrator" && session.role !== "office_manager") return json({error:"Not authorised."},403);
    const parts=url.pathname.split("/");
    const userId=parts[3], jobNumber=decodeURIComponent(parts.slice(4).join("/"));
    if (!userId || !jobNumber) return json({error:"Assignment not found."},400);
    await env.DB.prepare("DELETE FROM job_assignments WHERE user_id=? AND job_number=?").bind(userId,jobNumber).run();
    await audit(env,session,"job_unassigned",userId+":"+jobNumber);
    return json({ok:true});
  }
  if (request.method === "GET" && url.pathname === "/api/auth/users") {
    if (!can(session.role, "users:read")) return json({ error: "You do not have permission to view users." }, 403);
    const { results } = await env.DB.prepare("SELECT id, full_name AS name, staff_code AS staffCode, role, active FROM users ORDER BY full_name").all();
    return json({ users: results });
  }

  if (url.pathname === "/api/jobs" && request.method === "GET") {
    if (!can(session.role, "jobs:read") && session.role !== "employee") return json({error:"Not authorised."},403);
    let rows;
    rows = await env.DB.prepare("SELECT * FROM jobs ORDER BY updated_at DESC").all();
    return json({jobs:rows.results||[]});
  }
  if (url.pathname === "/api/jobs" && request.method === "POST") {
    if (!can(session.role, "jobs:write")) return json({error:"You do not have permission to create jobs."},403);
    const input=await body(request);
    const fields=["jobNumber","projectName","client","siteAddress","jobType","startDate","expectedFinishDate","projectManager","status","notes"];
    if (!input || fields.some(k=>input[k]!==undefined&&typeof input[k]!=="string") || !input.jobNumber?.trim() || !input.projectName?.trim()) return json({error:"Enter a job number and project name."},400);
    const values=fields.map(k=>String(input[k]||"").trim());
    if(values.some(v=>v.length>1000)||values[0].length>80||values[1].length>160) return json({error:"One or more job fields are too long."},400);
    const now=Math.floor(Date.now()/1000);
    try {
      await env.DB.prepare("INSERT INTO jobs (job_number,project_name,client,site_address,job_type,start_date,expected_finish_date,project_manager,status,notes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(values[0],values[1],values[2],values[3],values[4],values[5],values[6],values[7],values[8]||"Enquiry",values[9],session.user_id,now,now).run();
    } catch { return json({error:"That job number already exists."},409); }
    await audit(env,session,"job_created",values[0]);
    return json({jobNumber:values[0]},201);
  }
  const jobMatch=url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if(jobMatch&&request.method==="PATCH"){
    if(!can(session.role,"jobs:write"))return json({error:"You do not have permission to edit jobs."},403);
    const jobNumber=decodeURIComponent(jobMatch[1]),input=await body(request);
    const allowed={projectName:"project_name",client:"client",siteAddress:"site_address",jobType:"job_type",startDate:"start_date",expectedFinishDate:"expected_finish_date",projectManager:"project_manager",status:"status",notes:"notes"};
    if(!input||Object.keys(input).some(k=>!allowed[k]||typeof input[k]!=="string"||input[k].length>3000))return json({error:"Invalid job changes."},400);
    const entries=Object.entries(input);
    if(!entries.length)return json({error:"No changes supplied."},400);
    const set=entries.map(([k])=>allowed[k]+"=?").join(",");
    const result=await env.DB.prepare("UPDATE jobs SET "+set+",updated_at=? WHERE job_number=?").bind(...entries.map(([,v])=>v.trim()),Math.floor(Date.now()/1000),jobNumber).run();
    if(!result.meta?.changes)return json({error:"Job not found."},404);
    await audit(env,session,"job_updated",jobNumber);
    return json({ok:true});
  }
  if(jobMatch&&request.method==="GET"){
    if(!can(session.role,"jobs:read")&&session.role!=="employee")return json({error:"Not authorised."},403);
    const jobNumber=decodeURIComponent(jobMatch[1]);
    const job=await env.DB.prepare("SELECT * FROM jobs WHERE job_number=?").bind(jobNumber).first();
    if(!job)return json({error:"Job not found."},404);
    const updates=await env.DB.prepare("SELECT j.*,u.full_name AS creator_name FROM job_updates j JOIN users u ON u.id=j.created_by WHERE j.job_number=? ORDER BY j.created_at DESC LIMIT 200").bind(jobNumber).all();
    const assignments=await env.DB.prepare("SELECT a.user_id,a.job_number,u.full_name,u.staff_code FROM job_assignments a JOIN users u ON u.id=a.user_id WHERE a.job_number=? ORDER BY u.full_name").bind(jobNumber).all();
    const moduleRows=await env.DB.prepare("SELECT module_name,record_id,payload,updated_at FROM module_records WHERE job_number=? ORDER BY module_name,updated_at DESC").bind(jobNumber).all();
    const modulePermission={money:"money",plant:"plant",vehicles:"vehicles",workforce:"workforce",safety:"safety",documents:"documents",suppliers:"suppliers",materials:"suppliers",tooling:"plant",timesheets:"timesheets",daily_reports:"daily_reports"};
    const linkedRecords=(moduleRows.results||[]).filter(row=>can(session.role,(modulePermission[row.module_name]||"unknown")+":read")).map(row=>({module:row.module_name,id:row.record_id,record:JSON.parse(row.payload),updatedAt:row.updated_at}));
    return json({job,updates:updates.results||[],assignments:assignments.results||[],records:linkedRecords});
  }
  // Shared operational registers. Each record remains attached to its job number where supplied.
  const moduleRoute = url.pathname.match(/^\/api\/modules\/([a-z_]+)\/records(?:\/([^/]+))?$/);
  if (moduleRoute) {
    const moduleName = moduleRoute[1];
    const recordId = moduleRoute[2] ? decodeURIComponent(moduleRoute[2]) : null;
    const modulePermissions = {
      money: "money", plant: "plant", vehicles: "vehicles", workforce: "workforce", schedule: "schedule",
      safety: "safety", documents: "documents", suppliers: "suppliers",
      materials: "suppliers", tooling: "plant", timesheets: "timesheets", daily_reports: "daily_reports"
    };
    const permission = modulePermissions[moduleName];
    if (!permission) return json({error:"Unknown operational register."},404);
    if (request.method === "GET") {
      if (!can(session.role, permission+":read")) return json({error:"You do not have permission to view this register."},403);
      let rows;
      rows = await env.DB.prepare("SELECT record_id,job_number,payload,created_at,updated_at FROM module_records WHERE module_name=? ORDER BY updated_at DESC LIMIT 2000").bind(moduleName).all();
      return json({records:(rows.results||[]).map(row=>({id:row.record_id,jobNumber:row.job_number,record:JSON.parse(row.payload),createdAt:row.created_at,updatedAt:row.updated_at}))});
    }
    if (request.method === "POST" && !recordId) {
      if (!can(session.role, permission+":write")) return json({error:"You do not have permission to change this register."},403);
      const input=await body(request);
      if (!input || !input.record || typeof input.record!=="object" || Array.isArray(input.record)) return json({error:"A record is required."},400);
      const jobNumber=String(input.jobNumber||input.record["Job number"]||input.record.jobNumber||input.record.job_number||"").trim();
      if (session.role==="employee") {
        if (!jobNumber) return json({error:"Choose an assigned job for this record."},400);
        const assigned=await env.DB.prepare("SELECT 1 AS ok FROM job_assignments WHERE user_id=? AND job_number=?").bind(session.user_id,jobNumber).first();
        if (!assigned) return json({error:"You can only update records for jobs assigned to you."},403);
      }
      if (jobNumber) {
        const exists=await env.DB.prepare("SELECT 1 AS ok FROM jobs WHERE job_number=?").bind(jobNumber).first();
        if (!exists) return json({error:"Select a job from the shared Jobs & Sites register."},400);
      }
      const payload=JSON.stringify(input.record);
      if (payload.length>50000) return json({error:"Record is too large. Reduce attached text or files."},413);
      const id=String(input.id||input.record.id||randomToken(16)).slice(0,100);
      const now=Math.floor(Date.now()/1000);
      await env.DB.prepare("INSERT INTO module_records (module_name,record_id,job_number,payload,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(module_name,record_id) DO UPDATE SET job_number=excluded.job_number,payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
        .bind(moduleName,id,jobNumber,payload,session.user_id,session.user_id,now,now).run();
      await audit(env,session,"module_record_saved",moduleName+":"+id);
      return json({ok:true,id,jobNumber},201);
    }
    if (request.method === "DELETE" && recordId) {
      if (!can(session.role, permission+":write")) return json({error:"You do not have permission to change this register."},403);
      let result;
      if (session.role==="employee") {
        result=await env.DB.prepare("DELETE FROM module_records WHERE module_name=? AND record_id=? AND job_number IN (SELECT job_number FROM job_assignments WHERE user_id=?)").bind(moduleName,recordId,session.user_id).run();
      } else {
        result=await env.DB.prepare("DELETE FROM module_records WHERE module_name=? AND record_id=?").bind(moduleName,recordId).run();
      }
      if (!result.meta?.changes) return json({error:"Record not found or not assigned to you."},404);
      await audit(env,session,"module_record_deleted",moduleName+":"+recordId);
      return json({ok:true});
    }
    return json({error:"Method not allowed."},405);
  }

  if (url.pathname === "/api/job-updates" && request.method === "GET") {
    if (!can(session.role, "job_updates:read")) return json({ error: "Not authorised." }, 403);
    let result;
    result = await env.DB.prepare("SELECT j.*, u.full_name AS creator_name FROM job_updates j JOIN users u ON u.id=j.created_by ORDER BY j.created_at DESC LIMIT 500").all();
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
    const linkedJob=await env.DB.prepare("SELECT project_name FROM jobs WHERE job_number=?").bind(input.jobNumber.trim()).first();
    if(!linkedJob)return json({error:"Choose a job from the shared Jobs & Sites register."},400);
    if (session.role === "employee") {
      const assigned = await env.DB.prepare("SELECT 1 AS ok FROM job_assignments WHERE user_id=? AND job_number=?").bind(session.user_id, input.jobNumber).first();
      if (!assigned) return json({ error: "You can only update jobs assigned to you." }, 403);
    }
    const id = randomToken(16), now = Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO job_updates (id,job_number,job_name,stage,status,work_type,issue,next_action,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,input.jobNumber.trim(),String(linkedJob.project_name).slice(0,160),input.stage.trim().slice(0,80),input.status.trim().slice(0,80),input.workType.trim().slice(0,80),input.issue.trim().slice(0,120),input.nextAction.trim().slice(0,120),String(input.note||"").slice(0,3000),session.user_id,now).run();
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
    const update = await env.DB.prepare("SELECT id, job_number, created_by FROM job_updates WHERE id=?").bind(photoMatch[1]).first();
    if (!update) return json({ error: "Job update not found." }, 404);
    if (session.role === "employee" && update.created_by !== session.user_id) return json({ error: "You can only attach photos to your own updates." }, 403);
    const type = request.headers.get("Content-Type") || "";
    if (!["image/jpeg","image/png","image/webp"].includes(type.split(";")[0].trim().toLowerCase())) return json({ error: "Use a JPG, PNG or WebP image." }, 415);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 8*1024*1024) return json({ error: "Each photo must be 8 MB or smaller." }, 413);
    const data = await request.arrayBuffer();
    if (!data.byteLength || data.byteLength > 8*1024*1024) return json({ error: "Each photo must be between 1 byte and 8 MB." }, 413);
    const id = randomToken(16), key = id;
    const binary = Array.from(new Uint8Array(data), b => String.fromCharCode(b)).join("");
    const encoded = btoa(binary);
    await env.DB.prepare("INSERT INTO shared_files (id,file_name,content_type,data_base64,size_bytes,created_at) VALUES (?,?,?,?,?,?)")
      .bind(id,"site-photo",type.split(";")[0].trim().toLowerCase(),encoded,data.byteLength,new Date().toISOString()).run();
    const name = (request.headers.get("X-File-Name") || "site-photo").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120);
    await env.DB.prepare("INSERT INTO job_update_photos (id,update_id,object_key,file_name,content_type,size_bytes,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id,update.id,key,name,type.split(";")[0].trim().toLowerCase(),data.byteLength,session.user_id,Math.floor(Date.now()/1000)).run();
    await audit(env,session,"job_update_photo_uploaded",update.id);
    return json({ id, name, contentType:type.split(";")[0].trim().toLowerCase(), size:data.byteLength },201);
  }
  const getPhoto = url.pathname.match(/^\/api\/job-updates\/([a-f0-9]+)\/photos\/([a-f0-9]+)$/);
  if (getPhoto && request.method === "GET") {
    if (!can(session.role, "job_updates:read")) return json({ error: "Not authorised." },403);
    const photo = await env.DB.prepare("SELECT p.object_key,p.content_type,p.file_name,j.job_number,j.created_by FROM job_update_photos p JOIN job_updates j ON j.id=p.update_id WHERE p.id=? AND p.update_id=?").bind(getPhoto[2],getPhoto[1]).first();
    if (!photo) return json({ error: "Photo not found." },404);
    const stored = await env.DB.prepare("SELECT data_base64 FROM shared_files WHERE id=?").bind(photo.object_key).first();
    if (!stored) return json({ error: "Photo file not found." },404);
    const binary = atob(stored.data_base64), bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return new Response(bytes,{headers:{"content-type":photo.content_type,"content-disposition":'inline; filename="'+photo.file_name+'"',"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
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
