import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { notificationDeepLink, notificationRecipientRole, unsupportedNotificationChannels } from "../supabase/functions/_shared/notification-routing.mjs";

test("notification links use supported role-qualified portal routes", () => {
  for (const role of ["buyer", "seller", "admin"]) {
    assert.equal(notificationDeepLink(role, "booking_confirmed", { booking_id: "booking-1" }), `/app/${role}/bookings`);
    assert.equal(notificationDeepLink(role, "other", {}), `/app/${role}/notifications`);
  }
  assert.equal(notificationDeepLink("buyer", "new_message", { conversation_id: "conversation-1" }), "/app/buyer/messages/conversation-1");
  assert.equal(notificationDeepLink("seller", "new_message", { conversation_id: "conversation-1", booking_id: "booking-1" }), "/app/seller/messages/conversation-1");
  assert.equal(notificationDeepLink("admin", "new_message", { conversation_id: "conversation-1" }), "/app/admin/messages");
  assert.equal(notificationDeepLink("buyer", "quote_received", { request_id: "request-1" }), "/app/buyer/quotes");
  assert.equal(notificationDeepLink("seller", "verification_decision", {}), "/app/seller/kyc");
  assert.equal(notificationDeepLink("seller", "request_created", { request_id: "request-1" }), "/app/seller/requests");
  assert.equal(notificationDeepLink("buyer", "request_created", { request_id: "request-1" }), "/app/buyer/care-requests");
  assert.equal(notificationDeepLink("buyer", "purchase_receipt", { conversation_id: "conversation-1" }), "/app/buyer/wallet");
  assert.equal(notificationDeepLink("buyer", "purchase_receipt", { request_id: "request-1" }), "/app/buyer/wallet");
  assert.equal(notificationDeepLink("admin", "purchase_receipt", {}), "/app/admin/finance");
});

test("notification routing does not accept unknown roles or unescaped route segments", () => {
  assert.equal(notificationDeepLink(null, "new_message", {}), "/auth");
  assert.equal(notificationDeepLink("../admin", "new_message", {}), "/auth");
  assert.equal(notificationDeepLink("buyer", "new_message", { conversation_id: "abc/def?demo=1" }), "/app/buyer/messages/abc%2Fdef%3Fdemo%3D1");
});

test("dual-role notifications honor contextual membership and active roles", () => {
  assert.equal(notificationRecipientRole(["buyer", "seller"], "booking_confirmed", "seller"), "seller");
  assert.equal(notificationRecipientRole(["buyer", "seller"], "booking_confirmed", "buyer"), "buyer");
  assert.equal(notificationRecipientRole(["buyer", "seller"], "verification_decision", null), "seller");
  assert.equal(notificationRecipientRole(["buyer", "seller"], "quote_received", null), "buyer");
  assert.equal(notificationRecipientRole(["seller"], "booking_confirmed", "admin"), "seller");
  assert.equal(notificationRecipientRole(["admin"], "other", null), "admin");
  assert.equal(notificationRecipientRole([], "booking_confirmed", "seller"), null);
});

test("unconfigured external notification channels are identified without simulating delivery", () => {
  assert.deepEqual(unsupportedNotificationChannels({ email: true, push: true, sms: false }), ["push", "email"]);
  assert.deepEqual(unsupportedNotificationChannels({ email: false, push: false, sms: false }), []);
  assert.deepEqual(unsupportedNotificationChannels({ sms: true }), ["sms"]);
});

test("notification worker records unavailable transports as suppressed without retrying delivered in-app notifications", async () => {
  const source = await readFile(new URL("../supabase/functions/notification-worker/index.ts", import.meta.url), "utf8");
  assert.match(source, /vendor: "not-configured", status: "suppressed"/);
  assert.match(source, /error_code: "adapter_not_configured"/);
  assert.match(source, /status: notificationId \? "delivered" : "suppressed"/);
  assert.doesNotMatch(source, /throw new Error\(`external_notification_adapters_not_configured/);
});
