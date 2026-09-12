import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { isPathInside, sha256, validateManifest } from "../scripts/lan-backup.mjs";

test("backup checksum is deterministic", () => {
  assert.equal(sha256(Buffer.from("ENS")), "09ddf36201cda6a7b9c8ace9811b71087f9d38be4750f9e4706361dd2deb3787");
});

test("restore path guard accepts only files inside backup directory", () => {
  const root = resolve("backups");
  assert.equal(isPathInside(root, resolve("backups/example.dump")), true);
  assert.equal(isPathInside(root, resolve("outside.dump")), false);
});

test("backup manifest rejects checksum mismatch", () => {
  const buffer = Buffer.from("classroom-state");
  const manifest = {
    format_version: 1,
    project_id: "ens-sonson-local",
    sha256: "bad",
    includes: ["public", "private", "auth.users", "auth.identities"],
  };
  assert.throws(() => validateManifest(manifest, buffer), /checksum mismatch/i);
});

test("backup manifest accepts valid local classroom backup", () => {
  const buffer = Buffer.from("classroom-state");
  const manifest = {
    format_version: 1,
    project_id: "ens-sonson-local",
    sha256: sha256(buffer),
    includes: ["public", "private", "auth.users", "auth.identities"],
  };
  assert.equal(validateManifest(manifest, buffer), true);
});
