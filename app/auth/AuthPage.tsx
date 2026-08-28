"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BadgeCheck, HeartHandshake, LockKeyhole, ShieldCheck, Stethoscope } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";
import "./auth.css";
import "./auth-overrides.css";
import "./auth-marketplace.css";

type AuthMode = "login" | "signup" | "otp" | "recover";
type ContactMethod = "email" | "phone";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [method, setMethod] = useState<ContactMethod>("email");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [otpContact, setOtpContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  const setAuthMode = (next: AuthMode) => { setMode(next); setMessage(""); setOtpContact(""); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const contact = String(form.get("contact") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = getSupabase();
    if (!supabase) { router.push(`/app/${role}/overview`); return; }

    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(contact, { redirectTo: `${window.location.origin}/auth` });
        if (error) throw error;
        setMessage("If that address belongs to an account, recovery instructions will arrive shortly.");
        return;
      }
      if (mode === "otp") {
        const token = String(form.get("token") ?? "").trim();
        if (method === "phone" && otpContact && token) {
          const { error } = await supabase.auth.verifyOtp({ phone: otpContact, token, type: "sms" });
          if (error) throw error;
          router.replace("/app/buyer/overview");
          return;
        }
        const credentials = method === "email" ? { email: contact } : { phone: contact };
        const { error } = await supabase.auth.signInWithOtp({ ...credentials, options: { shouldCreateUser: false } });
        if (error) throw error;
        setOtpContact(contact);
        setMessage(method === "email" ? "Check your email for the secure sign-in link." : "Enter the one-time code sent to your phone.");
        return;
      }
      if (mode === "login") {
        const credentials = method === "email" ? { email: contact, password } : { phone: contact, password };
        const { error } = await supabase.auth.signInWithPassword(credentials); if (error) throw error;
        const { data: roles } = await supabase.from("user_roles").select("role").is("revoked_at", null);
        const next = roles?.some((item) => item.role === "admin") ? "admin" : roles?.some((item) => item.role === "seller") ? "seller" : "buyer";
        router.replace(`/app/${next}/overview`);
        return;
      }

      const displayName = String(form.get("displayName"));
      const options = { data: { display_name: displayName, requested_role: role } };
      const credentials = method === "email" ? { email: contact, password, options } : { phone: contact, password, options };
      const { data, error } = await supabase.auth.signUp(credentials); if (error) throw error;
      // The auth-user bootstrap trigger creates the buyer household or the
      // seller draft profile atomically. Never trust the client to self-elevate.
      setMessage(data.session ? "Account created. Opening Nanas…" : `Check your ${method} to confirm your Nanas account.`);
      if (data.session) router.replace(`/app/${role}/overview`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally { setBusy(false); }
  }

  const headline = mode === "signup" ? "Join Nanas." : mode === "recover" ? "Recover access." : mode === "otp" ? "Use a secure code." : "Welcome back.";
  const copy = mode === "signup" ? "Choose how you want to start. Buyer and seller are the only customer roles." : mode === "recover" ? "We send the same response whether or not an account exists." : mode === "otp" ? "Sign in without sharing a password." : "Continue to your care workspace.";

  return <main className="auth-shell">
    <section className="auth-story"><Link href="/" className="auth-wordmark">Nanas<span>.</span></Link><div className="auth-story-copy"><span>Healthcare across The Bahamas</span><h1>Care begins with <em>trust.</em></h1><p>One secure account for finding healthcare or personally providing approved care services.</p><ul><li><ShieldCheck/><span><b>Clear verification</b>Identity and healthcare credential decisions stay traceable.</span></li><li><LockKeyhole/><span><b>Private by default</b>Addresses, care notes, KYC files, and messages use scoped access.</span></li><li><BadgeCheck/><span><b>Accountable care</b>Bookings, simulated payments, and verified reviews share one record.</span></li></ul></div><small>Nanas is not an emergency service.</small></section>
    <section className="auth-form-side"><div className="auth-card">
      <div className="auth-tabs"><button className={mode==="login"?"active":""} onClick={()=>setAuthMode("login")}>Log in</button><button className={mode==="signup"?"active":""} onClick={()=>setAuthMode("signup")}>Create account</button></div>
      <h2>{headline}</h2><p>{copy}</p>
      {mode!=="recover"&&<div className="contact-tabs" aria-label="Contact method"><button className={method==="email"?"active":""} onClick={()=>setMethod("email")}>Email</button><button className={method==="phone"?"active":""} onClick={()=>setMethod("phone")}>Phone</button></div>}
      {mode==="signup"&&<div className="auth-role-options"><button className={role==="buyer"?"active":""} onClick={()=>setRole("buyer")}><HeartHandshake/><span><b>Buyer</b><small>I need healthcare or care support</small></span></button><button className={role==="seller"?"active":""} onClick={()=>setRole("seller")}><Stethoscope/><span><b>Seller</b><small>I personally provide healthcare services</small></span></button></div>}
      <form onSubmit={submit}>
        {mode==="signup"&&<label>Full name<input name="displayName" required autoComplete="name" placeholder="Your name"/></label>}
        {!(mode==="otp"&&method==="phone"&&otpContact)&&<label>{mode==="recover"||method==="email"?"Email":"Phone number"}<input type={mode==="recover"||method==="email"?"email":"tel"} name="contact" required autoComplete={method==="email"?"email":"tel"} placeholder={method==="email"?"you@example.com":"+1 242 555 0100"}/></label>}
        {(mode==="login"||mode==="signup")&&<label>Password<input type="password" name="password" required minLength={8} autoComplete={mode==="login"?"current-password":"new-password"} placeholder="At least 8 characters"/></label>}
        {mode==="otp"&&method==="phone"&&otpContact&&<label>One-time code<input name="token" inputMode="numeric" pattern="[0-9]{6}" required placeholder="6-digit code"/></label>}
        <button disabled={busy}>{busy?"Please wait…":mode==="login"?"Log in securely":mode==="signup"?"Create Nanas account":mode==="recover"?"Send recovery instructions":otpContact&&method==="phone"?"Verify code":"Send secure sign-in"}</button>
      </form>
      {mode==="login"&&<div className="auth-links"><button onClick={()=>setAuthMode("otp")}>Use a one-time sign-in</button><button onClick={()=>{setMethod("email");setAuthMode("recover");}}>Forgot password?</button></div>}
      {(mode==="recover"||mode==="otp")&&<div className="auth-links"><button onClick={()=>setAuthMode("login")}>Back to password login</button></div>}
      {message&&<div className="auth-message" role="status">{message}</div>}
      <div className="demo-access"><span>Local full-flow testing</span><div><Link href="/app/buyer/overview?demo=1">Buyer demo</Link><Link href="/app/seller/overview?demo=1">Seller demo</Link><Link href="/app/admin/overview?demo=1">Admin demo</Link></div><small>{configured?"Supabase is connected; demos remain available for scenario testing.":"Supabase keys are not configured yet, so local simulation is active."}</small></div>
      <footer>By continuing, you agree to the Nanas Terms and Privacy Policy.</footer>
    </div></section>
  </main>;
}
