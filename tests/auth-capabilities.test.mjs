import test from "node:test";
import assert from "node:assert/strict";
import { readAuthCapabilities } from "../lib/auth-capabilities.mjs";

const settings = (external, disable_signup = false) => async () => ({ ok: true, json: async () => ({ external, disable_signup }) });
const unavailable = { available: false, email: false, phone: false, signup: false };

test("auth settings expose only explicitly enabled methods and signup", async () => {
  assert.deepEqual(await readAuthCapabilities("https://example.supabase.co", "public", settings({ email: true, phone: false })), { available: true, email: true, phone: false, signup: true });
  assert.deepEqual(await readAuthCapabilities("https://example.supabase.co", "public", settings({ email: false, phone: true }, true)), { available: true, email: false, phone: true, signup: false });
  assert.deepEqual(await readAuthCapabilities("https://example.supabase.co", "public", settings({ email: true, phone: true })), { available: true, email: true, phone: true, signup: true });
});

test("auth settings request is uncached, bounded and uses only the supplied public key", async () => {
  await readAuthCapabilities("https://example.supabase.co/", "public-key", async (url, options) => {
    assert.equal(url, "https://example.supabase.co/auth/v1/settings");
    assert.deepEqual(options.headers, { apikey: "public-key" });
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ external: { email: true, phone: false }, disable_signup: false }) };
  });
});

test("missing configuration does not request settings", async () => {
  const forbidden = async () => { assert.fail("Unexpected request"); };
  assert.deepEqual(await readAuthCapabilities(undefined, "public", forbidden), unavailable);
  assert.deepEqual(await readAuthCapabilities("https://example.supabase.co", undefined, forbidden), unavailable);
});

test("network, HTTP, malformed and partial settings fail closed without leaking errors", async () => {
  for (const request of [
    async () => { throw new Error("private diagnostic"); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } }),
    settings({ email: "true", phone: false }),
    settings({ email: true }),
    settings({ email: true, phone: false }, "false"),
  ]) assert.deepEqual(await readAuthCapabilities("https://example.supabase.co", "public", request), unavailable);
});

test("a project with no enabled supported methods is distinct from an outage", async () => {
  assert.deepEqual(await readAuthCapabilities("https://example.supabase.co", "public", settings({ email: false, phone: false })), { available: true, email: false, phone: false, signup: true });
});
