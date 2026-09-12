import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const target = process.env.ENS_DB_TARGET;
const allowed = new Set(['local-empty', 'remote-empty-test']);

if (!allowed.has(target)) {
  throw new Error(`EMPTY DATABASE BOOTSTRAP ONLY: refusing target ${target ?? '<unset>'}. Allowed: local-empty, remote-empty-test.`);
}

const root = process.cwd();
const source = join(root, 'supabase', 'bootstrap', 'EMPTY_DATABASE_BOOTSTRAP_ONLY', '20260822000000_empty_database_bootstrap.sql');
const destination = join(root, 'supabase', 'migrations', '00000000000000_EMPTY_DATABASE_BOOTSTRAP_ONLY.sql');

if (!existsSync(source)) throw new Error('Empty-database bootstrap source is missing.');
copyFileSync(source, destination);
console.log(`Materialized EMPTY DATABASE BOOTSTRAP ONLY for ${target}: ${destination}`);
