export const json = (body: unknown, status = 200) => Response.json(body, { status });

export const safeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const safe = /^[a-z0-9_ .:-]{1,160}$/i.test(message) ? message : "Request could not be completed";
  return json({ ok: false, error: safe }, 400);
};

export const requireObject = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("json_body_required");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_body");
  return body as Record<string, unknown>;
};

export const requireString = (value: unknown, key: string, max = 2000) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`invalid_${key}`);
  return value.trim();
};

export const requireIdempotencyKey = (request: Request) => {
  const key = request.headers.get("idempotency-key");
  if (!key || key.length < 8 || key.length > 120) throw new Error("idempotency_key_required");
  return key;
};

export const assertNoError = <T>(result: { data: T; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

export const verifyHmac = async (request: Request, secret: string, signatureHeader = "x-nanas-signature") => {
  const signature = request.headers.get(signatureHeader);
  if (!signature || !secret) return { ok: false as const, body: "" };
  const body = await request.text();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const expected = signature.replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/i.test(expected)) return { ok: false as const, body };
  const bytes = new Uint8Array(expected.match(/.{2}/g)!.map((hex) => Number.parseInt(hex, 16)));
  return { ok: await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(body)), body };
};
