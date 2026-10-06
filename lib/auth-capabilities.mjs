const unavailable = () => ({ available: false, email: false, phone: false, signup: false });

// Public Auth settings only. Never send a service-role key to this endpoint.
export async function readAuthCapabilities(url, publishableKey, request = fetch) {
  if (!url || !publishableKey) return unavailable();
  try {
    const response = await request(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return unavailable();
    const data = await response.json();
    if (typeof data?.external?.email !== "boolean" || typeof data?.external?.phone !== "boolean" || typeof data?.disable_signup !== "boolean") return unavailable();
    return { available: true, email: data.external.email, phone: data.external.phone, signup: !data.disable_signup };
  } catch {
    return unavailable();
  }
}
