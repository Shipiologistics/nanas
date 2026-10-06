"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, HeartHandshake, LockKeyhole, ShieldCheck, Stethoscope } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";
import { ownWorkspace, workspaceRoute } from "../../lib/auth-routing.mjs";
import "./auth.css";
import "./auth-overrides.css";
import "./auth-marketplace.css";

type AuthMode = "login" | "signup" | "otp" | "recover" | "reset";
type ContactMethod = "email" | "phone";
type AuthCapabilities = { available: boolean; email: boolean; phone: boolean; signup: boolean };

export default function AuthPage({ capabilities, initialRole = "buyer", initialMode = "login", nextPath, showDemo = false }: { capabilities: AuthCapabilities; initialRole?: "buyer" | "seller"; initialMode?: "login" | "signup"; nextPath?: string; showDemo?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [preferredMethod, setMethod] = useState<ContactMethod>("email");
  const method: ContactMethod = capabilities[preferredMethod] ? preferredMethod : capabilities.email ? "email" : "phone";
  const [role, setRole] = useState<"buyer" | "seller">(initialRole);
  const [otpContact, setOtpContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accountMismatch, setAccountMismatch] = useState<{requestedRole:string|null;ownWorkspace:string|null}|null>(null);
  const navigationAttempt = useRef(0);
  const configured = isSupabaseConfigured();

  const openWorkspace = useCallback(async () => {
    const attempt = ++navigationAttempt.current;
    const supabase = getSupabase();
    if (!supabase) throw new Error("Account service is unavailable. Please try again later.");
    const { data: userData, error } = await supabase.auth.getUser();
    if (attempt !== navigationAttempt.current) return;
    if (error || !userData.user) throw error ?? new Error("Please sign in again.");
    const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).is("revoked_at", null);
    if (attempt !== navigationAttempt.current) return;
    if (roleError) throw roleError;
    const activeRoles = (roles ?? []).map(item=>item.role);
    const route = workspaceRoute(nextPath,activeRoles);
    if (!route.destination) {
      setAccountMismatch({requestedRole:route.requestedRole,ownWorkspace:ownWorkspace(activeRoles)});
      return;
    }
    router.replace(route.destination);
  }, [nextPath, router]);

  useEffect(() => {
    const navigation = navigationAttempt;
    const recovering = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const supabase = getSupabase();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { clearTimeout(timer); setMode("reset"); }
      else if (event === "SIGNED_OUT") { ++navigationAttempt.current; clearTimeout(timer); setAccountMismatch(null); }
      else if (!recovering && session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // Defer account queries until Supabase releases its auth-event lock.
        timer = setTimeout(() => { void openWorkspace().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to open your account.")); }, 0);
      }
    });
    return () => { ++navigation.current; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [openWorkspace]);

  async function switchAccount() {
    if (busy) return;
    setBusy(true);setMessage("");
    ++navigationAttempt.current;
    try {
      const supabase=getSupabase();
      if (!supabase) throw new Error("Account service is unavailable. Please try again later.");
      // Explicit user action; never sign someone out merely for following a link.
      // Local scope leaves their sessions on other devices signed in.
      const {error}=await supabase.auth.signOut({scope:"local"});
      if(error) throw error;
      setAccountMismatch(null);setMode("login");setMethod("email");setOtpContact("");
      setMessage("Signed out of this browser. Sign in with an account that can access the requested workspace.");
    } catch(error) {setMessage(error instanceof Error ? error.message : "Could not sign out. Please retry.");}
    finally {setBusy(false);}
  }

  const setAuthMode = (next: AuthMode) => { setMode(next); setMessage(""); setOtpContact(""); };
  const buyerDemoHref = nextPath?.startsWith("/app/buyer/")
    ? `${nextPath}${nextPath.includes("?") ? "&" : "?"}demo=1`
    : "/app/buyer/overview?demo=1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const contact = String(form.get("contact") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = getSupabase();
    if (!supabase) { setMessage("Account service is unavailable. Please try again later."); setBusy(false); return; }

    try {
      if (!capabilities.available || (!capabilities.email && !capabilities.phone)) throw new Error("Sign-in methods are unavailable. Reload this page to try again.");
      if (mode === "signup" && !capabilities.signup) throw new Error("New account registration is currently unavailable.");
      if (mode === "recover" && !capabilities.email) throw new Error("Email recovery is currently unavailable.");
      if (mode === "reset") {
        if (password !== String(form.get("confirmPassword") ?? "")) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Password updated. You can now sign in.");
        setMode("login");
        return;
      }
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(contact, { redirectTo: `${window.location.origin}/auth${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}` });
        if (error) throw error;
        setMessage("If that address belongs to an account, recovery instructions will arrive shortly.");
        return;
      }
      if (mode === "otp") {
        const token = String(form.get("token") ?? "").trim();
        if (method === "phone" && otpContact && token) {
          const { error } = await supabase.auth.verifyOtp({ phone: otpContact, token, type: "sms" });
          if (error) throw error;
          await openWorkspace();
          return;
        }
        const credentials = method === "email" ? { email: contact } : { phone: contact };
        const { error } = await supabase.auth.signInWithOtp({ ...credentials, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}` } });
        if (error) throw error;
        setOtpContact(contact);
        setMessage(method === "email" ? "Check your email for the secure sign-in link." : "Enter the one-time code sent to your phone.");
        return;
      }
      if (mode === "login") {
        const credentials = method === "email" ? { email: contact, password } : { phone: contact, password };
        const { error } = await supabase.auth.signInWithPassword(credentials); if (error) throw error;
        await openWorkspace();
        return;
      }

      const displayName = String(form.get("displayName"));
      const options = { data: { display_name: displayName, requested_role: role }, emailRedirectTo: `${window.location.origin}/auth${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}` };
      const credentials = method === "email" ? { email: contact, password, options } : { phone: contact, password, options };
      const { data, error } = await supabase.auth.signUp(credentials); if (error) throw error;
      // The auth-user bootstrap trigger creates the buyer household or the
      // seller draft profile atomically. Never trust the client to self-elevate.
      setMessage(data.session ? "Account created. Opening Nanas…" : `Check your ${method} to confirm your Nanas account.`);
      if (data.session) await openWorkspace();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally { setBusy(false); }
  }

  const headline = mode === "reset" ? "Choose a new password." : mode === "signup" ? "Join Nanas." : mode === "recover" ? "Recover access." : mode === "otp" ? method === "email" ? "Use a secure email link." : "Use a secure code." : "Welcome back.";
  const copy = mode === "signup" ? "Find trusted help or join as a care provider." : mode === "reset" ? "Use at least eight characters and confirm your new password." : mode === "recover" ? "Enter your email to receive recovery instructions." : mode === "otp" ? "Sign in without sharing a password." : "Continue to your care workspace.";

  return <main className="auth-shell">
    <section className="auth-story"><Link href="/" className="auth-wordmark">Nanas<span>.</span></Link><div className="auth-story-copy"><span>Care &amp; household help across The Bahamas</span><h1>Care begins with <em>trust.</em></h1><p>One secure account for finding trusted help or providing care and household services.</p><ul><li><ShieldCheck/><span><b>Clear verification</b>Identity and service credential decisions stay traceable.</span></li><li><LockKeyhole/><span><b>Private by default</b>Addresses, care notes, KYC files, and messages use scoped access.</span></li><li><BadgeCheck/><span><b>Accountable care</b>Bookings, simulated payments, and verified reviews share one record.</span></li></ul></div><small>Nanas is not an emergency service.</small></section>
    <section className="auth-form-side"><div className="auth-card">
      {accountMismatch ? <section className="auth-account-choice" aria-label="Choose a workspace account">
        <h2>Use the right account.</h2>
        <p>{accountMismatch.requestedRole ? `Your current account cannot access the ${accountMismatch.requestedRole === "seller" ? "provider" : accountMismatch.requestedRole} workspace.` : "Your current account has no active workspace role."} Signing in does not grant additional permissions.</p>
        {accountMismatch.ownWorkspace && <Link href={accountMismatch.ownWorkspace}>Return to my workspace</Link>}
        <button type="button" disabled={busy} onClick={()=>void switchAccount()}>{busy ? "Signing out…" : "Sign out and use another account"}</button>
      </section> : <>
      <div className="auth-tabs"><button disabled={busy} className={mode==="login"?"active":""} onClick={()=>setAuthMode("login")}>Log in</button>{capabilities.signup&&<button disabled={busy} className={mode==="signup"?"active":""} onClick={()=>setAuthMode("signup")}>Create account</button>}</div>
      <h2>{headline}</h2><p>{copy}</p>
      {!capabilities.available || (!capabilities.email && !capabilities.phone) ? <div className="auth-message" role="status"><p>{capabilities.available ? "No supported sign-in method is enabled. Please contact Nanas support." : "We could not load sign-in options. Please try again."}</p><button type="button" onClick={()=>window.location.reload()}>Retry sign-in options</button></div> : mode==="signup"&&!capabilities.signup ? <div className="auth-message" role="status">New account registration is currently unavailable. Existing members can log in.</div> : <>
      {mode!=="recover"&&mode!=="reset"&&<div className="contact-tabs" aria-label="Contact method">{capabilities.email&&<button disabled={busy} aria-pressed={method==="email"} className={method==="email"?"active":""} onClick={()=>{setMethod("email");setOtpContact("");setMessage("");}}>Email</button>}{capabilities.phone&&<button disabled={busy} aria-pressed={method==="phone"} className={method==="phone"?"active":""} onClick={()=>{setMethod("phone");setOtpContact("");setMessage("");}}>Phone</button>}</div>}
      {mode==="signup"&&<div className="auth-role-options"><button aria-pressed={role==="buyer"} className={role==="buyer"?"active":""} onClick={()=>setRole("buyer")}><HeartHandshake/><span><b>Buyer</b><small>I need care or household help</small></span></button><button aria-pressed={role==="seller"} className={role==="seller"?"active":""} onClick={()=>setRole("seller")}><Stethoscope/><span><b>Care provider</b><small>I provide care or household services</small></span></button></div>}
      <form onSubmit={submit}>
        {mode==="signup"&&<label>Full name<input name="displayName" required autoComplete="name" placeholder="Your name"/></label>}
        {mode!=="reset"&&!(mode==="otp"&&method==="phone"&&otpContact)&&<label>{mode==="recover"||method==="email"?"Email":"Phone number"}<input type={mode==="recover"||method==="email"?"email":"tel"} name="contact" required autoComplete={method==="email"?"email":"tel"} placeholder={method==="email"?"you@example.com":"+1 242 555 0100"}/></label>}
        {(mode==="login"||mode==="signup"||mode==="reset")&&<label>Password<input type="password" name="password" required minLength={8} autoComplete={mode==="login"?"current-password":"new-password"} placeholder="At least 8 characters"/></label>}
        {mode==="reset"&&<label>Confirm new password<input type="password" name="confirmPassword" minLength={8} required autoComplete="new-password"/></label>}
        {mode==="otp"&&method==="phone"&&otpContact&&<label>One-time code<input name="token" inputMode="numeric" pattern="[0-9]{6}" required placeholder="6-digit code"/></label>}
        <button disabled={busy}>{busy?"Please wait…":mode==="reset"?"Update password":mode==="login"?"Log in securely":mode==="signup"?"Create Nanas account":mode==="recover"?"Send recovery instructions":otpContact&&method==="phone"?"Verify code":"Send secure sign-in"}</button>
      </form>
      {mode==="login"&&<div className="auth-links"><button disabled={busy} onClick={()=>setAuthMode("otp")}>Use a one-time sign-in</button>{capabilities.email&&<button disabled={busy} onClick={()=>{setMethod("email");setAuthMode("recover");}}>Forgot password?</button>}</div>}
      {(mode==="recover"||mode==="otp")&&<div className="auth-links"><button onClick={()=>setAuthMode("login")}>Back to password login</button></div>}
      </>}
      </>}
      {message&&<div className="auth-message" role="status">{message}</div>}
      {showDemo && <div className="demo-access"><span>Local full-flow testing</span><div><Link href={buyerDemoHref}>Buyer demo</Link><Link href="/app/seller/overview?demo=1">Provider demo</Link><Link href="/app/admin/overview?demo=1">Admin demo</Link></div><small>{configured?"Supabase is configured; demos remain available for scenario testing.":"Supabase keys are not configured yet. Use an explicit demo for local simulation."}</small></div>}
      <footer>By continuing, you agree to the Nanas Terms and Privacy Policy.</footer>
    </div></section>
  </main>;
}
