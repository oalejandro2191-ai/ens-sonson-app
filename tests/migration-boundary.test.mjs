import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationsDir = join(root, 'supabase', 'migrations');
const localDir = join(root, 'supabase', 'local');
const bootstrapDir = join(root, 'supabase', 'bootstrap', 'EMPTY_DATABASE_BOOTSTRAP_ONLY');
const rollbackDir = join(root, 'supabase', 'rollback');

const forbidden = [
  /TEST[- ]ONLY/i,
  /local_test_/i,
  /@ens\.local/i,
  /Other School Test/i,
  /LOCAL8A/i,
  /OTHER8X/i,
  /LocalPilot!2026/i,
  /EMPTY DATABASE BOOTSTRAP ONLY/i,
];

const expectedIncremental = new Set([
  '20260822000001_staging_security_hardening.sql',
  '20260822000002_student_read_api.sql',
  '20260822000003_fix_valid_review_spacing.sql',
  '20260822000004_active_route_session_recovery.sql',
  '20260822000005_admin_portal_read_api.sql',
  '20260822000006_public_reference_rls.sql',
  '20260823000007_admin_management_mvp.sql',
]);

function walk(path, files = []) {
  if (!existsSync(path)) return files;
  for (const name of readdirSync(path)) {
    const full = join(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

test('incremental migration set contains only reviewed candidates', () => {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
  assert.deepEqual(new Set(files), expectedIncremental, `unexpected incremental migration set: ${files.join(', ')}`);
  for (const file of files) {
    const source = readFileSync(join(migrationsDir, file), 'utf8');
    for (const pattern of forbidden) assert(!pattern.test(source), `${file} contains forbidden marker ${pattern}`);
  }
});

test('empty database baseline is physically outside incremental migrations', () => {
  const bootstrap = join(bootstrapDir, '20260822000000_empty_database_bootstrap.sql');
  const readme = join(bootstrapDir, 'README.md');
  assert(existsSync(bootstrap), 'empty-database bootstrap missing');
  assert(existsSync(readme), 'bootstrap boundary README missing');
  assert.match(readFileSync(readme, 'utf8'), /EMPTY DATABASE BOOTSTRAP ONLY/);
  assert(!existsSync(join(migrationsDir, '20260822000000_local_pilot_baseline.sql')));
  assert(!existsSync(join(migrationsDir, '00000000000000_EMPTY_DATABASE_BOOTSTRAP_ONLY.sql')), 'ephemeral bootstrap must never be committed');
});

test('local fixtures and service helpers stay outside incremental migrations', () => {
  assert(existsSync(join(localDir, 'seed.sql')), 'supabase/local/seed.sql missing');
  assert(existsSync(join(localDir, 'test_helpers.sql')), 'supabase/local/test_helpers.sql missing');
  assert(!existsSync(join(migrationsDir, '20260822000002_local_test_helpers.sql')));
});

test('active-session candidate has an explicit rollback outside migrations', () => {
  const rollback = join(rollbackDir, '20260822000004_active_route_session_recovery.rollback.sql');
  assert(existsSync(rollback), 'active-session rollback missing');
  const source = readFileSync(rollback, 'utf8');
  assert.match(source, /drop function if exists public\.get_my_active_route_session_v1\(text\)/i);
  assert.match(source, /create or replace function public\.start_route_lesson_session_v1/i);
});

test('admin portal read candidate has an explicit rollback outside migrations', () => {
  const rollback = join(rollbackDir, '20260822000005_admin_portal_read_api.rollback.sql');
  assert(existsSync(rollback), 'admin portal read rollback missing');
  const source = readFileSync(rollback, 'utf8');
  assert.match(source, /drop function if exists public\.get_my_admin_portal_v1\(\)/i);
  assert.match(source, /drop function if exists private\.require_institution_admin\(\)/i);
});

test('public reference RLS candidate has an explicit rollback outside migrations', () => {
  const rollback = join(rollbackDir, '20260822000006_public_reference_rls.rollback.sql');
  assert(existsSync(rollback), 'public reference RLS rollback missing');
  const source = readFileSync(rollback, 'utf8');
  assert.match(source, /alter table public\.vocabulary_words disable row level security/i);
  assert.match(source, /alter table public\.academic_years disable row level security/i);
});

test('admin management candidate has an explicit non-destructive functional rollback', () => {
  const rollback = join(rollbackDir, '20260823000007_admin_management_mvp.rollback.sql');
  assert(existsSync(rollback), 'admin management rollback missing');
  const source = readFileSync(rollback, 'utf8');
  assert.match(source, /drop function if exists public\.admin_create_group_v1/i);
  assert.match(source, /drop function if exists public\.admin_set_student_status_v1/i);
  assert.match(source, /drop function if exists public\.admin_delete_unused_vocabulary_word_v1/i);
  assert.match(source, /create or replace function public\.get_my_admin_portal_v1/i);
  assert.doesNotMatch(source, /drop column\s+status/i, 'rollback must not destroy archive state columns');
});

test('browser source contains no service-role credential path', () => {
  const browserRoots = ['app', 'components', 'features', 'lib'];
  const code = browserRoots.flatMap((dir) => walk(join(root, dir)))
    .filter((file) => new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']).has(extname(file)));
  for (const file of code) {
    const source = readFileSync(file, 'utf8');
    assert(!/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(source), `privileged Supabase credential reference in browser source: ${file}`);
  }
});
