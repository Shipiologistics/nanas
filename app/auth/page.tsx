import AuthPage from "./AuthPage";
import { safeWorkspacePath } from "../../lib/auth-routing.mjs";
import { readAuthCapabilities } from "../../lib/auth-capabilities.mjs";

export default async function AuthenticationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeWorkspacePath(query.next);
  const capabilities = await readAuthCapabilities(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return <AuthPage capabilities={capabilities} initialRole={query.role === "seller" || query.role === "provider" ? "seller" : "buyer"} initialMode={query.mode === "signup" ? "signup" : "login"} nextPath={next} showDemo={process.env.NODE_ENV === "development" || process.env.ENABLE_DEMO_MODE === "true"} />;
}
