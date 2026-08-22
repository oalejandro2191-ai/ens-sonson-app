import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const localDir = join(process.cwd(), 'supabase', 'local');

const forbidden = [
  /TEST[- ]ONLY/i,
  /local_test_/i,
  /@ens\.local/i,
  /Other School Test/i,
  /LOCAL8A/i,
  /OTHER8X/i,
  /LocalPilot!2026/i,
];

test('deployable migrations contain no local-only fixtures or helpers', () => {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
  assert(files.length > 0, 'expected deployable migrations');
  for (const file of files) {
    const source = readFileSync(join(migrationsDir, file), 'utf8');
    for (const pattern of forbidden) {
      assert(!pattern.test(source), `${file} contains local-only marker ${pattern}`);
    }
    assert(!/local_test_helpers/i.test(file), `${file} must not be deployable`);
  }
});

test('local fixtures live outside supabase/migrations', () => {
  assert(existsSync(join(localDir, 'seed.sql')), 'supabase/local/seed.sql missing');
  assert(existsSync(join(localDir, 'test_helpers.sql')), 'supabase/local/test_helpers.sql missing');
  assert(!existsSync(join(migrationsDir, '20260822000002_local_test_helpers.sql')));
});
