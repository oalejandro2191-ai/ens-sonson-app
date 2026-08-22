import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const activeRoots = ["app", "components", "features", "lib"];
const forbidden = ["Sofía Martínez", "127 palabras", "Avatar Studio", "2.180 XP", "2180 XP", "1.240 monedas", "1240 monedas"];
function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(target) : [target];
  });
}
test("active staging source contains no known production demo identities or fake academic stats", () => {
  const text = activeRoots.flatMap(collectFiles).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const marker of forbidden) assert.equal(text.includes(marker), false, `forbidden demo marker: ${marker}`);
});
