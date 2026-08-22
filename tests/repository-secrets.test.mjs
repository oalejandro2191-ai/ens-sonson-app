import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import test from 'node:test';

const roots = ['app','components','features','lib','supabase','.github','tests'];
const textExtensions = new Set(['.ts','.tsx','.js','.mjs','.sql','.toml','.yml','.yaml','.md','.txt']);
const explicitFiles = new Set(['.env.example','.env.local.example']);
const secretPatterns = [
  { name: 'Supabase secret key literal', rx: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: 'JWT-like literal', rx: /eyJhbGciOi[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/ },
  { name: 'Postgres URL with literal password', rx: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/$<{]+@/i },
  { name: 'service-role literal assignment', rx: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"'$<{][^"']{12,}["']/ },
];

function walk(path, files=[]) {
  for (const name of readdirSync(path)) {
    const full = join(path,name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full,files);
    else if (textExtensions.has(extname(name)) || explicitFiles.has(name)) files.push(full);
  }
  return files;
}

test('repository contains no committed secret-looking literals', () => {
  const files = roots.flatMap((root) => walk(join(process.cwd(),root)));
  for (const file of files) {
    const source = readFileSync(file,'utf8');
    for (const {name,rx} of secretPatterns) {
      assert(!rx.test(source), `${name} found in ${file}`);
    }
  }
});
