"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "../../lib/supabase";
import { activeAdministratorAccount, preserveWorkspaceDuringRefresh } from "../../lib/workspace-session.mjs";

export default function PortalAccess({ role, children }: { role: string; children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "signed-out" | "denied" | "unavailable">("loading");
  const [returnTo, setReturnTo] = useState(`/app/${role}/overview`);
  useEffect(() => {
    let active = true;
    let revision = 0;
    let verifiedUserId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const supabase = getSupabase();
    const update = (value: "loading" | "allowed" | "signed-out" | "denied" | "unavailable") => { if (active) setStatus(value); };
    queueMicrotask(() => { if (active) setReturnTo(window.location.pathname + window.location.search + window.location.hash); });
    if (!supabase) { queueMicrotask(() => update("unavailable")); return () => { active=false; }; }
    async function verify() {
      const attempt = ++revision;
      const commit = (value: "allowed" | "signed-out" | "denied" | "unavailable") => { if (attempt === revision) update(value); };
      try {
        const { data, error } = await supabase!.auth.getUser();
        if (attempt !== revision || !active) return;
        if (!data.user) { commit(error && error.name !== "AuthSessionMissingError" ? "unavailable" : "signed-out"); return; }
        const result = await supabase!.from("user_roles").select("role").eq("user_id", data.user.id).is("revoked_at", null);
        if (result.error) { commit("unavailable"); return; }
        const profile = role === "admin" ? await supabase!.from("profiles").select("account_status,deleted_at").eq("id",data.user.id).maybeSingle() : null;
        if (profile?.error) { commit("unavailable"); return; }
        if (attempt !== revision || !active) return;
        const allowed = result.data?.some((item) => item.role === role) && (role !== "admin" || activeAdministratorAccount(profile?.data));
        verifiedUserId = allowed ? data.user.id : null;
        commit(allowed ? "allowed" : "denied");
      } catch { commit("unavailable"); }
    }
    void verify();
    const recheck = () => { if (document.visibilityState === "visible") void verify(); };
    const statusTimer = role === "admin" ? setInterval(recheck,30_000) : undefined;
    if (role === "admin") document.addEventListener("visibilitychange",recheck);
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { verifiedUserId=null;++revision;clearTimeout(timer);update("signed-out"); }
      else if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        ++revision;clearTimeout(timer);
        if (!preserveWorkspaceDuringRefresh(verifiedUserId,session?.user.id)) { verifiedUserId=null;update("loading"); }
        timer=setTimeout(()=>void verify(),0);
      }
    });
    return () => { active = false; ++revision; clearTimeout(timer);clearInterval(statusTimer);document.removeEventListener("visibilitychange",recheck); listener.subscription.unsubscribe(); };
  }, [role]);
  if (status === "allowed") return children;
  return <main className="portal-access" style={{maxWidth:560,margin:"12vh auto",padding:24}}>
    <Link href="/">Nanas</Link>
    <h1>{status === "loading" ? "Checking your account…" : status === "denied" ? "This account cannot access this workspace." : status === "unavailable" ? "Account access is temporarily unavailable." : "Sign in to your Nanas account."}</h1>
    <p>{status === "loading" ? "Please wait while we verify access." : status === "unavailable" ? "We could not verify your account. Please try again shortly." : status === "denied" ? "The required role or account status is unavailable. Contact support, switch accounts, or return to your own workspace." : "Your bookings, messages and account information are available after sign-in."}</p>
    {status !== "loading" && <Link style={{display:"inline-flex",alignItems:"center",minHeight:44}} href={`/auth?next=${encodeURIComponent(returnTo)}`}>{status === "denied" ? "Choose another account" : "Continue to sign in"}</Link>}
  </main>;
}
