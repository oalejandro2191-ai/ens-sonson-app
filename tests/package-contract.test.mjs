import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
test("canonical runtime versions are pinned", () => {
  assert.equal(pkg.dependencies.next, "16.3.3");
  assert.equal(pkg.dependencies.react, "19.2.0");
  assert.equal(pkg.dependencies["react-dom"], "19.2.0");
  assert.equal(pkg.devDependencies["eslint-config-next"], "16.3.3");
});
test("secure transitive overrides are pinned", () => {
  assert.equal(pkg.overrides["js-yaml"], "4.3.2");
  assert.equal(pkg.overrides.sharp, "0.35.4");
});
test("required validation and classroom safety scripts exist", () => {
  for (const script of ["typecheck", "lint", "test", "build", "check", "lan:prepare", "lan:start", "lan:backup", "lan:restore"]) {
    assert.ok(pkg.scripts[script]);
  }
});
