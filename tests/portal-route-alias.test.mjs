import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../app/app/[[...route]]/page.tsx", import.meta.url),
  "utf8",
);

test("bare buyer provider route redirects to the provider directory", () => {
  assert.match(source, /role === "buyer" && route\[1\] === "providers" && !route\[2\]/);
  assert.match(source, /redirect\(`\/app\/buyer\/find-care/);
});

test("provider detail routes remain available", () => {
  assert.match(source, /buyer: \[[^\]]*"providers"/);
  assert.doesNotMatch(source, /route\[1\] === "providers" && route\[2\]/);
});
