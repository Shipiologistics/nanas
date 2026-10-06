/**
 * Build only routes actually supported by the portal. The caller resolves role
 * from active database membership, never from client-supplied event variables.
 * @param {string | null} role
 * @param {string} templateKey
 * @param {Record<string, unknown>} variables
 */
export function notificationDeepLink(role, templateKey, variables) {
  if (!["buyer", "seller", "admin"].includes(role ?? "")) return "/auth";
  const base = `/app/${role}`;
  if (templateKey === "purchase_receipt") return `${base}/${role === "buyer" ? "wallet" : role === "admin" ? "finance" : "earnings"}`;
  if (role === "admin") {
    if (variables.conversation_id) return `${base}/messages`;
    if (variables.booking_id) return `${base}/bookings`;
    return `${base}/notifications`;
  }
  if (typeof variables.conversation_id === "string" && variables.conversation_id) {
    return `${base}/messages/${encodeURIComponent(variables.conversation_id)}`;
  }
  if (variables.booking_id) return `${base}/bookings`;
  if (templateKey === "verification_decision" || templateKey === "verification_submitted") {
    return `${base}/${role === "seller" ? "kyc" : "account"}`;
  }
  if (templateKey === "quote_received") return `${base}/quotes`;
  if (variables.request_id) return `${base}/${role === "seller" ? "requests" : "care-requests"}`;
  return `${base}/notifications`;
}

/**
 * Respect the role in the specific booking/conversation for dual-role users.
 * @param {string[]} activeRoles
 * @param {string} templateKey
 * @param {string | null} contextualRole
 * @returns {string | null}
 */
export function notificationRecipientRole(activeRoles, templateKey, contextualRole) {
  if (contextualRole && activeRoles.includes(contextualRole)) return contextualRole;
  if (templateKey.startsWith("verification_") && activeRoles.includes("seller")) return "seller";
  if (templateKey === "quote_received" && activeRoles.includes("buyer")) return "buyer";
  return ["buyer", "seller", "admin"].find((role) => activeRoles.includes(role)) ?? null;
}

/** External delivery must never be reported as successful without an adapter.
 * @param {{push?: boolean, email?: boolean, sms?: boolean}} preference
 */
export function unsupportedNotificationChannels(preference) {
  return /** @type {const} */ (["push", "email", "sms"]).filter((channel) => preference[channel]);
}
