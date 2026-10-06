import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "./database.types";

export async function authenticatedApiClient(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!token) throw new Error("Authentication required");
  if (!url || !publishableKey) throw new Error("Supabase server configuration is incomplete");

  const supabase = createClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Authentication required");
  return { supabase, user: data.user };
}

export async function requireSellerRole(
  supabase: Awaited<ReturnType<typeof authenticatedApiClient>>["supabase"],
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "seller")
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) throw new Error("Seller role required");
}

export async function requireActiveAccount(
  supabase: Awaited<ReturnType<typeof authenticatedApiClient>>["supabase"],
  userId: string,
) {
  const { data, error } = await supabase.from("profiles")
    .select("account_status,deleted_at").eq("id", userId).maybeSingle();
  if (error || data?.account_status !== "active" || data.deleted_at) {
    throw new Error("Active account required");
  }
}
