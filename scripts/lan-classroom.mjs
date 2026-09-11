import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const PROJECT_ID = "ens-sonson-local";
const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_EMAIL = "admin@ens.local";
const MARKER_FILE = resolve(".ens-lan-initialized");
const CREDENTIAL_FILE = resolve(".ens-lan-admin.json");

export function parseEnvOutput(text) {
  const result = {};
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

export function replaceLoopback(url, ip) {
  return String(url).replace("127.0.0.1", ip).replace("localhost", ip);
}

export function isPrivateIpv4(ip) {
  const parts = String(ip).split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

export function pickLanIpFromInterfaces(interfaces, override = "") {
  if (override) {
    if (!isPrivateIpv4(override) && override !== "127.0.0.1") {
      throw new Error("ENS_LAN_IP must be a private IPv4 address (10.x, 172.16-31.x, 192.168.x).");
    }
    return override;
  }
  const candidates = [];
  for (const entries of Object.values(interfaces ?? {})) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (isPrivateIpv4(entry.address)) candidates.push(entry.address);
    }
  }
  if (!candidates.length) throw new Error("No private LAN IPv4 address detected. Connect the teacher computer to the classroom hotspot/router or set ENS_LAN_IP.");
  const preferred = candidates.find((ip) => ip.startsWith("192.168.")) ?? candidates[0];
  return preferred;
}

export function sqlLiteral(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function run(command, args, { capture = false, input, env = process.env, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    input,
    encoding: "utf8",
    stdio: capture ? ["pipe", "pipe", "pipe"] : ["inherit", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? `\n${result.stderr || result.stdout || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.${detail}`);
  }
  return result;
}

function supabase(args, options) {
  return run("supabase", args, options);
}

async function authAdminRequest(apiUrl, serviceKey, path, init = {}) {
  const response = await fetch(apiUrl + path, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Local Auth Admin ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

function loadCredentials() {
  if (!existsSync(CREDENTIAL_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CREDENTIAL_FILE, "utf8"));
    if (parsed?.email === ADMIN_EMAIL && typeof parsed.password === "string" && parsed.password.length >= 16) return parsed;
  } catch {}
  return null;
}

function saveCredentials(password) {
  writeFileSync(CREDENTIAL_FILE, JSON.stringify({ email: ADMIN_EMAIL, password }, null, 2) + "\n", { mode: 0o600 });
  try { chmodSync(CREDENTIAL_FILE, 0o600); } catch {}
}

function generatePassword() {
  return `Ens!${randomBytes(18).toString("base64url")}9aA`;
}

function findDatabaseContainer() {
  const result = run("docker", ["ps", "--format", "{{.Names}}"], { capture: true });
  const names = result.stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return names.find((name) => name === `supabase_db_${PROJECT_ID}`) ??
    names.find((name) => name.startsWith("supabase_db_") && name.includes(PROJECT_ID));
}

function configureAdminMembership(userId) {
  const container = findDatabaseContainer();
  if (!container) throw new Error("Could not find the local Supabase Postgres container.");
  const sql = `
begin;
insert into public.profiles(id, school_id, role, display_alias)
values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(SCHOOL_ID)}::uuid, 'teacher', 'Administrador Aula Local')
on conflict (id) do update
set school_id=excluded.school_id, role=excluded.role, display_alias=excluded.display_alias, updated_at=now();

insert into private.institution_memberships(school_id, user_id, role, status)
values (${sqlLiteral(SCHOOL_ID)}::uuid, ${sqlLiteral(userId)}::uuid, 'institution_admin', 'active')
on conflict (school_id, user_id, role) do update set status='active';
commit;
`;
  run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql });
}

async function ensureLocalAdmin(apiUrl, serviceKey) {
  const listing = await authAdminRequest(apiUrl, serviceKey, "/auth/v1/admin/users?page=1&per_page=100");
  const users = Array.isArray(listing?.users) ? listing.users : [];
  let user = users.find((item) => item.email === ADMIN_EMAIL);
  let creds = loadCredentials();

  if (!creds) {
    creds = { email: ADMIN_EMAIL, password: generatePassword() };
    saveCredentials(creds.password);
  }

  if (!user) {
    const created = await authAdminRequest(apiUrl, serviceKey, "/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: creds.password,
        email_confirm: true,
        user_metadata: { full_name: "Administrador Aula Local", lan_fixture: true },
      }),
    });
    user = created?.user ?? created;
  } else if (!existsSync(CREDENTIAL_FILE)) {
    await authAdminRequest(apiUrl, serviceKey, `/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ password: creds.password }),
    });
  }

  if (!user?.id) throw new Error("Local classroom administrator could not be created.");
  configureAdminMembership(user.id);
  return creds;
}

function initializeLocalDatabase(forceReset) {
  const firstRun = !existsSync(MARKER_FILE);
  const mustReset = forceReset || firstRun;

  if (mustReset) run(process.execPath, ["scripts/assemble-empty-db-bootstrap.mjs"]);
  try {
    supabase(["start"]);
    if (mustReset) supabase(["db", "reset", "--local"]);
  } finally {
    if (mustReset) run(process.execPath, ["scripts/remove-empty-db-bootstrap.mjs"], { allowFailure: true });
  }
  return { firstRun, reset: mustReset };
}

async function verifyLanBackend(lanApiUrl, anonKey) {
  const response = await fetch(lanApiUrl + "/auth/v1/settings", { headers: { apikey: anonKey } });
  if (!response.ok) throw new Error(`LAN backend is not reachable at ${lanApiUrl} (HTTP ${response.status}). Check firewall/hotspot isolation.`);
}

export async function main(argv = process.argv.slice(2)) {
  const prepareOnly = argv.includes("--prepare-only");
  const forceReset = argv.includes("--reset");
  const lanIp = pickLanIpFromInterfaces(networkInterfaces(), process.env.ENS_LAN_IP ?? "");

  console.log("\nENS English · Classroom LAN mode");
  console.log(`Teacher computer LAN IP: ${lanIp}`);

  const init = initializeLocalDatabase(forceReset);
  const status = supabase(["status", "-o", "env"], { capture: true });
  const envs = parseEnvOutput(status.stdout);
  const apiLocal = envs.API_URL;
  const anonKey = envs.ANON_KEY;
  const serviceKey = envs.SERVICE_ROLE_KEY;
  if (!apiLocal || !anonKey || !serviceKey) throw new Error("Supabase status did not return API_URL, ANON_KEY and SERVICE_ROLE_KEY.");

  const lanApiUrl = replaceLoopback(apiLocal, lanIp);
  const creds = await ensureLocalAdmin(apiLocal, serviceKey);
  await verifyLanBackend(lanApiUrl, anonKey);

  if (init.reset) {
    writeFileSync(MARKER_FILE, new Date().toISOString() + "\n");
  }

  const appEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: lanApiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_ENS_ROUTE_CODE: "A1-V3",
    NEXT_PUBLIC_APP_ENV: "local",
    NEXT_PUBLIC_ACADEMIC_DATA_MODE: "backend",
    NEXT_PUBLIC_COMMIT_SHA: "lan-local",
  };

  const studentUrl = `http://${lanIp}:3000/estudiante`;
  const adminUrl = `http://${lanIp}:3000/admin`;

  console.log("\nLocal backend ready.");
  console.log(`Student URL: ${studentUrl}`);
  console.log(`Admin URL:   ${adminUrl}`);
  console.log(`Admin user:  ${creds.email}`);
  console.log(`Admin password (local only): ${creds.password}`);
  console.log("Keep this computer and student devices on the same trusted hotspot/router.");
  console.log("Do not expose ports 3000 or 54321 to the public Internet.\n");

  if (prepareOnly) {
    console.log("Preparation complete. Classroom data will be preserved on future lan:start runs.");
    return;
  }

  console.log("Building optimized classroom server...");
  run("npm", ["run", "build"], { env: appEnv });
  console.log("Starting ENS English on 0.0.0.0:3000 ...");
  const child = spawn("npm", ["run", "start", "--", "-H", "0.0.0.0", "-p", "3000"], {
    cwd: process.cwd(),
    env: appEnv,
    stdio: "inherit",
  });

  const stop = () => {
    if (!child.killed) child.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
}

const direct = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (direct) {
  main().catch((error) => {
    console.error("\nLAN mode failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
