import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("privileged Supabase key markers are never referenced by active browser source", () => {
  const files = ["app", "components", "features", "lib"];
  const stack = [...files];
  let text = "";
  while (stack.length) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) stack.push(`${current}/${child}`);
    } else text += fs.readFileSync(current, "utf8");
  }
  assert.equal(/SUPABASE_SERVICE_ROLE_KEY|DATABASE_PASSWORD|DB_PASSWORD/.test(text), false);
});

test("environment example exposes only browser-safe Supabase variables", () => {
  const env = fs.readFileSync(".env.example", "utf8");
  assert.match(env, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(env, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
  assert.equal(/SERVICE_ROLE|DATABASE_PASSWORD|DB_PASSWORD/.test(env), false);
});
