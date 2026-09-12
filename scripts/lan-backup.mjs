import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PROJECT_ID = "ens-sonson-local";
const MARKER_FILE = resolve(".ens-lan-initialized");
const DEFAULT_BACKUP_DIR = resolve("backups");
const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
const BACKUP_FORMAT_VERSION = 1;

function run(command, args, { capture = false, input, env = process.env, binary = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    input,
    encoding: binary ? null : "utf8",
    maxBuffer: MAX_BACKUP_BYTES,
    stdio: capture ? ["pipe", "pipe", "pipe"] : ["inherit", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = capture && !binary ? `\n${result.stderr || result.stdout || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.${detail}`);
  }
  return result;
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function isPathInside(parent, child) {
  const root = resolve(parent);
  const target = resolve(child);
  return target === root || target.startsWith(root + sep);
}

export function validateManifest(manifest, dumpBuffer) {
  if (!manifest || manifest.format_version !== BACKUP_FORMAT_VERSION) throw new Error("Unsupported or missing ENS LAN backup manifest version.");
  if (manifest.project_id !== PROJECT_ID) throw new Error("Backup belongs to a different local project.");
  if (manifest.sha256 !== sha256(dumpBuffer)) throw new Error("Backup checksum mismatch. The dump may be damaged or incomplete.");
  if (!Array.isArray(manifest.includes) || !manifest.includes.includes("public") || !manifest.includes.includes("private")) {
    throw new Error("Backup manifest is missing required classroom schemas.");
  }
  return true;
}

function findDatabaseContainer() {
  const result = run("docker", ["ps", "--format", "{{.Names}}"], { capture: true });
  const names = result.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const exact = `supabase_db_${PROJECT_ID}`;
  if (!names.includes(exact)) throw new Error(`Expected local database container ${exact} is not running. Run npm run lan:prepare first.`);
  return exact;
}

function ensureInitialized() {
  if (!existsSync(MARKER_FILE)) throw new Error("Classroom LAN database is not initialized. Run npm run lan:prepare before backup or restore.");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function manifestPathFor(dumpPath) {
  return `${dumpPath}.json`;
}

function loadAndValidateBackup(dumpPath) {
  const backupDir = resolve(process.env.ENS_LAN_BACKUP_DIR || DEFAULT_BACKUP_DIR);
  if (!isPathInside(backupDir, dumpPath)) throw new Error(`Restore is limited to the classroom backup directory: ${backupDir}`);
  if (!existsSync(dumpPath)) throw new Error(`Backup file not found: ${dumpPath}`);
  const manifestPath = manifestPathFor(dumpPath);
  if (!existsSync(manifestPath)) throw new Error(`Backup manifest not found: ${manifestPath}`);
  const dumpBuffer = readFileSync(dumpPath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  validateManifest(manifest, dumpBuffer);
  return { dumpBuffer, manifest, manifestPath };
}

export function createBackup({ label = "classroom" } = {}) {
  ensureInitialized();
  const container = findDatabaseContainer();
  const backupDir = resolve(process.env.ENS_LAN_BACKUP_DIR || DEFAULT_BACKUP_DIR);
  mkdirSync(backupDir, { recursive: true });
  const safeLabel = String(label).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "classroom";
  const dumpPath = resolve(backupDir, `ens-lan-${safeLabel}-${timestamp()}.dump`);

  const args = [
    "exec", container,
    "pg_dump", "-U", "postgres", "-d", "postgres",
    "--format=custom", "--data-only", "--no-owner", "--no-privileges",
    "--table=public.*", "--table=private.*",
    "--table=auth.users", "--table=auth.identities",
  ];
  const result = run("docker", args, { capture: true, binary: true });
  const dumpBuffer = result.stdout;
  if (!Buffer.isBuffer(dumpBuffer) || dumpBuffer.length < 128) throw new Error("Backup dump is unexpectedly empty.");
  writeFileSync(dumpPath, dumpBuffer, { mode: 0o600 });

  const manifest = {
    format_version: BACKUP_FORMAT_VERSION,
    project_id: PROJECT_ID,
    created_at: new Date().toISOString(),
    dump_file: basename(dumpPath),
    bytes: dumpBuffer.length,
    sha256: sha256(dumpBuffer),
    includes: ["public", "private", "auth.users", "auth.identities"],
    note: "Logical classroom-state backup. Repository assets remain versioned in Git; this file contains local database state and Auth hashes.",
  };
  writeFileSync(manifestPathFor(dumpPath), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  console.log(`Backup created: ${dumpPath}`);
  console.log(`BACKUP_PATH=${dumpPath}`);
  return dumpPath;
}

function resetLocalDatabase() {
  const localEnv = { ...process.env, ENS_DB_TARGET: "local-empty" };
  run(process.execPath, ["scripts/assemble-empty-db-bootstrap.mjs"], { env: localEnv });
  try {
    run("supabase", ["start"]);
    run("supabase", ["db", "reset", "--local"]);
  } finally {
    run(process.execPath, ["scripts/remove-empty-db-bootstrap.mjs"], { env: localEnv, allowFailure: true });
  }
}

function truncateRestorableData(container) {
  const sql = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'private')
    ORDER BY schemaname, tablename
  LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', r.schemaname, r.tablename);
  END LOOP;
END $$;
TRUNCATE TABLE auth.identities, auth.users CASCADE;
`;
  run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql });
}

export function restoreBackup(dumpPath, { confirmed = false } = {}) {
  ensureInitialized();
  if (!confirmed) throw new Error("Restore is destructive. Re-run with --confirm-restore after verifying the selected backup.");
  const absoluteDump = resolve(dumpPath);
  const { dumpBuffer, manifest } = loadAndValidateBackup(absoluteDump);

  const safetyBackup = createBackup({ label: "pre-restore" });
  console.log(`Safety backup before restore: ${safetyBackup}`);

  resetLocalDatabase();
  const container = findDatabaseContainer();
  truncateRestorableData(container);

  const result = run("docker", [
    "exec", "-i", container,
    "pg_restore", "-U", "postgres", "-d", "postgres",
    "--data-only", "--disable-triggers", "--no-owner", "--no-privileges", "--exit-on-error",
  ], { capture: true, input: dumpBuffer });
  if (result.status !== 0) throw new Error("pg_restore failed unexpectedly.");

  const restoredMarker = {
    restored_at: new Date().toISOString(),
    source: basename(absoluteDump),
    source_created_at: manifest.created_at,
    source_sha256: manifest.sha256,
  };
  const receiptPath = resolve(dirname(absoluteDump), `${basename(absoluteDump)}.restored.json`);
  writeFileSync(receiptPath, JSON.stringify(restoredMarker, null, 2) + "\n", { mode: 0o600 });
  console.log(`Restore completed from: ${absoluteDump}`);
  console.log(`RESTORE_RECEIPT=${receiptPath}`);
  return receiptPath;
}

export function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (command === "backup") {
    createBackup();
    return;
  }
  if (command === "restore") {
    const dumpPath = argv.find((arg) => !arg.startsWith("--") && arg !== "restore");
    if (!dumpPath) throw new Error("Usage: npm run lan:restore -- backups/<file>.dump --confirm-restore");
    restoreBackup(dumpPath, { confirmed: argv.includes("--confirm-restore") });
    return;
  }
  throw new Error("Usage: node scripts/lan-backup.mjs backup | restore <dump> --confirm-restore");
}

const direct = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (direct) {
  try {
    main();
  } catch (error) {
    console.error("LAN backup/restore failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
