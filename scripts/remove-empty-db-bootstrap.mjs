import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const file = join(process.cwd(), 'supabase', 'migrations', '00000000000000_EMPTY_DATABASE_BOOTSTRAP_ONLY.sql');
if (existsSync(file)) unlinkSync(file);
console.log('Ephemeral empty-database bootstrap removed from incremental migration directory.');
