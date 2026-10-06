import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [readme, envExample, vercel] = await Promise.all([
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../vercel.json", import.meta.url), "utf8"),
]);

test("Vercel setup documents every required server credential without a public secret prefix", () => {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    assert.match(readme, new RegExp(`\\b${name}\\b`), name);
    assert.match(envExample, new RegExp(`^${name}=`, "m"), name);
  }
  assert.doesNotMatch(readme, /NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|CLOUDINARY_API_SECRET)/);
  assert.doesNotMatch(envExample, /^NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|CLOUDINARY_API_SECRET)=/m);
});

test("Vercel retains native Next.js framework detection", () => {
  assert.equal(JSON.parse(vercel).framework, "nextjs");
});
