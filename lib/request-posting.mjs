/** Keep an unchanged checkout retry stable across a page reload, without storing
 * private intake data in the retry record. The database verifies the payload. */
export async function requestPostingKey(payload, buyerId, storage) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const storageKey = `nanas-request-checkout:${buyerId}`;
  let saved;
  try { saved = JSON.parse(storage.getItem(storageKey) ?? "null"); } catch { saved = null; }
  if (saved?.signature === signature && typeof saved.key === "string" && saved.key.length >= 8 && saved.key.length <= 200) return saved.key;
  const key = `request:${crypto.randomUUID()}`;
  storage.setItem(storageKey, JSON.stringify({ signature, key }));
  return key;
}
