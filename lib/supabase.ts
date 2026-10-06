import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import {clearCredentialRetries} from "./credential-retry.mjs";

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
    );
    if(typeof window!=="undefined") {
      let lastUserId:string|null=null;
      browserClient.auth.onAuthStateChange((event,session)=>{
        const nextUserId=session?.user.id ?? null;
        if(event==="SIGNED_OUT" || (lastUserId && nextUserId && lastUserId!==nextUserId))
          clearCredentialRetries(()=>window.sessionStorage);
        lastUserId=nextUserId;
      });
    }
  }
  return browserClient;
}
