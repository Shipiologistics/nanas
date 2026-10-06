import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [portal, profileStudio, marketplaceDetails, home, marketplaceShell, publicPages, demoData] = await Promise.all([
  readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/app/SellerProfileStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/app/TargetedMarketplaceDetails.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/NanasHome.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/marketplace/MarketplaceShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/marketplace/PublicMarketplacePages.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/demo-data.ts", import.meta.url), "utf8"),
]);

test("general marketplace copy covers care and household services", () => {
  assert.match(portal, /Trusted care and household help across The Bahamas/);
  assert.match(portal, /Care and household catalog/);
  assert.match(profileStudio, /Care and household service profiles/);
  assert.doesNotMatch(portal, /Trusted healthcare across The Bahamas/);
  assert.doesNotMatch(portal, /approved healthcare providers/);
  assert.doesNotMatch(portal, /Healthcare care/);
  assert.doesNotMatch(marketplaceDetails, /Approved healthcare/);
  for (const stale of [
    "approved seller results",
    "Show {visibleSellers.length} seller",
    "approved seller{",
    "seller messages",
    "eligible seller",
    "safe seller summary",
    "No seller can charge",
  ]) assert.doesNotMatch(portal, new RegExp(stale.replace(/[{}]/g, "\\$&"), "i"));
  assert.doesNotMatch(demoData, /Top care seller/);
  assert.match(demoData, /Top care provider/);
  assert.match(portal, /badge === "Top care seller" \? "Top care provider" : badge/);
  for (const source of [home, marketplaceShell, publicPages]) {
    assert.match(source, /\/become-a-provider/);
    assert.doesNotMatch(source, /href=(?:"|\{\s*")\/become-a-seller/);
  }
});

test("home healthcare remains a supported named service", () => {
  assert.match(portal, /Home healthcare/);
});
