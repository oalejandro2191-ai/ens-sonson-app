import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
test("canonical runtime versions are pinned", () => {
  assert.equal(pkg.dependencies.next, "16.3.0");
  assert.equal(pkg.dependencies.react, "19.2.0");
  assert.equal(pkg.dependencies["react-dom"], "19.2.0");
});
test("required validation scripts exist", () => {
  for (const script of ["typecheck", "lint", "test", "build", "check"]) assert.ok(pkg.scripts[script]);
});
