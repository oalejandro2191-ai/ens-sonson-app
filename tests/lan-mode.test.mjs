import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateIpv4, parseEnvOutput, pickLanIpFromInterfaces, replaceLoopback, sqlLiteral } from "../scripts/lan-classroom.mjs";

test("LAN env parser accepts Supabase env output", () => {
  const env = parseEnvOutput('API_URL="http://127.0.0.1:54321"\nANON_KEY=abc\nexport SERVICE_ROLE_KEY=secret\n');
  assert.equal(env.API_URL, "http://127.0.0.1:54321");
  assert.equal(env.ANON_KEY, "abc");
  assert.equal(env.SERVICE_ROLE_KEY, "secret");
});

test("LAN URL replaces loopback host", () => {
  assert.equal(replaceLoopback("http://127.0.0.1:54321", "192.168.10.5"), "http://192.168.10.5:54321");
  assert.equal(replaceLoopback("http://localhost:54321", "10.0.0.7"), "http://10.0.0.7:54321");
});

test("LAN IP selection prefers private non-internal IPv4", () => {
  const ip = pickLanIpFromInterfaces({
    lo0: [{ family:"IPv4", internal:true, address:"127.0.0.1" }],
    en0: [{ family:"IPv4", internal:false, address:"192.168.50.12" }],
  });
  assert.equal(ip, "192.168.50.12");
});

test("LAN private IPv4 guard", () => {
  assert.equal(isPrivateIpv4("192.168.1.2"), true);
  assert.equal(isPrivateIpv4("10.0.0.5"), true);
  assert.equal(isPrivateIpv4("172.20.4.1"), true);
  assert.equal(isPrivateIpv4("8.8.8.8"), false);
});

test("SQL literal escapes quotes", () => {
  assert.equal(sqlLiteral("O'Brien"), "'O''Brien'");
});
