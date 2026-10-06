"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabase } from "../../lib/supabase";
import { issueUploadUrl } from "../../lib/nanas-api";
import { uploadImage } from "../../lib/cloudinary-client";
import { VerificationEvidence } from "./VerificationEvidence";
import { credentialDateWarning } from "../../lib/credential-dates.mjs";
import { credentialIssuer, credentialRetryKey, decodeCredentialRetry, encodeCredentialRetry } from "../../lib/credential-retry.mjs";
import styles from "./service-credentials.module.css";

type CatalogService = { id: string; name: string; required_credential_types: string[] };
type Credential = {
  id: string; provider_name: string; credential_type: string; service_name: string | null;
  issuing_body: string | null; issue_date: string | null; expiry_date: string | null;
  status: string; effective_status: string; case_id: string | null; decision_reason: string | null;
};
const title = (value: string) => value.replaceAll("_", " ");
const message = (error: unknown) => {
  const code = error && typeof error === "object" && "message" in error ? String(error.message) : "Credential request failed. Please retry.";
  return ({ inspect_credential_evidence_first: "Load and inspect the private evidence before approving.", credential_not_current: "This credential is not current. Request a replacement with valid dates.", credential_already_decided: "This record was already decided. Refresh the records before continuing.", permission_denied: "Your account cannot perform this credential action." } as Record<string,string>)[code] ?? code.replaceAll("_", " ");
};
async function call(name: string, args: Record<string, unknown>) {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw error;
  return data;
}

export function ServiceCredentials({ admin = false, userId }: { admin?: boolean; userId:string }) {
  const [rows, setRows] = useState<Credential[]>([]);
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scope, setScope] = useState("");
  const [kind, setKind] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [pendingSummary,setPendingSummary]=useState<{fileName:string;kind:string;issuer:string}|null>(null);
  const [retryReady,setRetryReady]=useState(admin);
  const [discardConfirm,setDiscardConfirm]=useState(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const activeSubmission=useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Nassau" }).format(new Date());
  const kinds = [...new Set(catalog.filter(s => !scope || s.id === scope).flatMap(s => s.required_credential_types))].filter(k => k !== "identity").sort();
  useEffect(()=>{activeSubmission.current=true;return()=>{activeSubmission.current=false;};},[]);
  useEffect(()=>{
    if(admin)return;
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      try {
        const saved=sessionStorage.getItem(credentialRetryKey(userId));
        if(saved){
          const restored=decodeCredentialRetry(saved,userId);
          if(restored){pending.current=restored;setPendingSummary({fileName:restored.p_original_name,kind:restored.p_credential_type,issuer:restored.p_issuing_body});setPrepared(true);}
          else {sessionStorage.removeItem(credentialRetryKey(userId));setNotice("Saved retry details could not be restored. Check your credential records before uploading again.");}
        }
      } catch {setNotice("This tab cannot save recovery details. Enable session storage before submitting credentials.");}
      setRetryReady(true);
    });
    return()=>{active=false;};
  },[admin,userId]);

  function discardRetry() {
    try {sessionStorage.removeItem(credentialRetryKey(userId));}
    catch {setError("Retry details could not be cleared. Keep this tab open and check browser storage settings.");return;}
    pending.current=null;setPrepared(false);setPendingSummary(null);setDiscardConfirm(false);
    formRef.current?.reset();setScope("");setKind("");setNoExpiry(false);
    setNotice("Local retry details discarded. Uploaded evidence and any saved review record have not been deleted.");
  }

  const fetchPage = useCallback(async (cursor: string | null) => {
      const result = await call("service_credential_records", { p_after: cursor, p_limit: 20 }) as unknown as { items: Credential[] };
      if (!Array.isArray(result?.items)) throw new Error("Credential records could not be loaded");
      let services: CatalogService[]=[];
      if (!admin) {
        const response = await getSupabase()!.from("services").select("id,name,required_credential_types").eq("active",true).order("name");
        if (response.error) throw response.error;
        services=response.data;
      }
      return {items:result.items,services,cursor};
  },[admin]);
  const applyPage = useCallback((page: {items:Credential[];services:CatalogService[];cursor:string|null})=>{
    setError("");setRows(page.items.slice(0,20));setHasMore(page.items.length>20);setAfter(page.cursor);setCatalog(page.services);setLoading(false);
  },[]);
  const load = useCallback(async (cursor:string|null)=>{
    try {applyPage(await fetchPage(cursor));}
    catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  },[fetchPage,applyPage]);
  useEffect(() => {
    let active=true;
    fetchPage(null).then(page=>{if(active) applyPage(page);}).catch(cause=>{if(active){setError(message(cause));setLoading(false);}});
    return ()=>{active=false;};
  },[fetchPage,applyPage]);

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); if (busy || !retryReady) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!pending.current) {
        if(!event)throw new Error("Choose evidence before submitting.");
        const form = new FormData(event.currentTarget);
        const file = form.get("evidence") as File;
        if (!file?.size || file.size > 8*1024*1024 || !["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) throw new Error("Choose a JPEG, PNG, WebP or PDF up to 8 MB.");
        if (!kinds.includes(kind)) throw new Error("Select a required credential type for this scope.");
        const issuer=credentialIssuer(form.get("issuer"));
        const issued=String(form.get("issued") ?? "");
        const expires=String(form.get("expiry") ?? "");
        if (!issued || issued>today || (!noExpiry && (!expires || expires<issued))) throw new Error("Use a valid issue date and an expiry date on or after it.");
        // Check recovery storage before uploading private evidence.
        const probe=credentialRetryKey(userId)+":probe";
        try {sessionStorage.setItem(probe,"recovery-check");sessionStorage.removeItem(probe);}
        catch {throw new Error("Enable session storage in this tab before uploading so interrupted submissions can be recovered.");}
        const path = file.type === "application/pdf" ? (await issueUploadUrl("seller-documents",file)).path : (await uploadImage(file,"verification")).databasePath;
        // Navigation/sign-out during upload must not recreate cleared recovery
        // metadata or submit on behalf of a different account afterward.
        if(!activeSubmission.current)return;
        pending.current = { p_submission_id:crypto.randomUUID(),p_credential_type:kind,p_service_id:scope || null,
          p_issuing_body:issuer,p_issue_date:form.get("issued"),p_expiry_date:noExpiry ? null : form.get("expiry"),p_storage_path:path,p_original_name:file.name.slice(0,180) };
        setPrepared(true);
        setPendingSummary({fileName:file.name.slice(0,180),kind,issuer});
      }
      try {sessionStorage.setItem(credentialRetryKey(userId),encodeCredentialRetry(userId,pending.current));}
      catch {throw new Error("The upload is ready, but recovery details could not be saved. Keep this tab open, check browser storage, then retry.");}
      await call("submit_service_credential",pending.current);
      try {sessionStorage.removeItem(credentialRetryKey(userId));} catch {/* A stale retry safely replays the same submission UUID. */}
      pending.current=null; setPrepared(false);setPendingSummary(null); formRef.current?.reset(); setScope(""); setKind(""); setNoExpiry(false);
      await load(null); setNotice("Credential submitted for private review. It does not qualify you for a service until approved and current.");
    } catch (cause) { setError(message(cause) + (pending.current ? " Retry submission to reuse the same evidence safely; do not upload again." : "")); }
    finally { setBusy(false); }
  }

  async function review(event: FormEvent<HTMLFormElement>, row: Credential) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      await call("admin_review_service_credential",{p_credential_id:row.id,p_decision:form.get("decision"),p_note:String(form.get("reason")).trim()});
      await load(after); setNotice("Credential decision saved with an audit record. Unrelated services and provider approval were not changed.");
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  return <section className={`portal-panel ${styles.panel}`} aria-label="Service credentials">
    <h2>{admin ? "Service credential review" : "Your service credentials"}</h2>
    <p>Service credentials are separate from identity approval. Only approved, current records with the right service scope meet catalogue requirements. Expiry uses Bahamas dates.</p>
    {error && <p className={styles.feedback} role="alert">{error}</p>}
    {notice && <p className={styles.feedback} role="status">{notice}</p>}
    {!admin && prepared && pendingSummary && <div className={styles.feedback} role="status">
      <strong>Uploaded evidence awaiting confirmation</strong>
      <p>{pendingSummary.fileName} · {title(pendingSummary.kind)} · {pendingSummary.issuer}</p>
      <p>Retry uses the same submission ID and uploaded evidence, even if the first attempt already saved. Recovery details remain only in this tab until success, sign-out or closing the tab. Check existing records before discarding.</p>
      <button type="button" disabled={busy || loading} onClick={()=>{setDiscardConfirm(false);void submit();}}>Retry submission</button>
      <button type="button" disabled={busy} onClick={()=>setDiscardConfirm(true)}>Discard retry details</button>
      {discardConfirm && <div><p>This forgets only local recovery details. It does not delete uploaded evidence or undo a saved submission. Uploading again may create another review record.</p><button type="button" disabled={busy} onClick={discardRetry}>Confirm discard</button><button type="button" onClick={()=>setDiscardConfirm(false)}>Keep retry details</button></div>}
    </div>}
    {!admin && !prepared && <details className={styles.submission}>
      <summary>Submit a service credential</summary>
      <p>Use identity verification above for government ID. For corrections or renewal, submit new evidence; previous decisions remain in the record.</p>
      <form className="portal-form" onSubmit={submit} ref={formRef}>
        <fieldset disabled={busy || prepared || loading || !retryReady} className={styles.fields}>
          <label>Service scope<select value={scope} onChange={e=>{setScope(e.target.value);setKind("");}}><option value="">All applicable services</option>{catalog.filter(s=>s.required_credential_types.some(k=>k!=="identity")).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          <label>Credential type<select required value={kind} onChange={e=>setKind(e.target.value)}><option value="">Choose a required credential</option>{kinds.map(k=><option key={k} value={k}>{title(k)}</option>)}</select></label>
          <label>Issuing body<input name="issuer" required minLength={2} maxLength={160} /></label>
          <label>Issue date<input name="issued" type="date" required max={today} /></label>
          <label className={styles.check}><input type="checkbox" checked={noExpiry} onChange={e=>setNoExpiry(e.target.checked)} />The evidence explicitly has no expiry date</label>
          {!noExpiry && <label>Expiry date<input name="expiry" type="date" required /></label>}
          <label>Private credential evidence<input name="evidence" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" /></label>
          <p>JPEG, PNG, WebP or PDF; maximum 8 MB. Do not upload someone else’s documents. Images use private Cloudinary delivery; PDFs use private Supabase storage.</p>
        </fieldset>
        <button type="submit" disabled={busy || loading || !retryReady}>{busy ? "Submitting…" : "Submit credential for review"}</button>
      </form>
    </details>}
    <button type="button" onClick={()=>{setLoading(true);void load(after);}} disabled={loading || busy}>Refresh credential records</button>
    {loading && <p role="status">Loading credential records…</p>}
    {!loading && !error && rows.length===0 && <p>No service credential records on this page.</p>}
    <div className={styles.records}>{rows.map(row=>{const dateWarning=credentialDateWarning(row,today);return <article className={styles.record} key={row.id}>
      <h3>{title(row.credential_type)}</h3>
      {admin && <p>{row.provider_name}</p>}
      <p><strong>{title(row.effective_status)}</strong> · {row.service_name ?? "All applicable services"}</p>
      <dl><div><dt>Issuing body</dt><dd>{row.issuing_body ?? "Not recorded"}</dd></div><div><dt>Issued</dt><dd>{row.issue_date ?? "Not recorded"}</dd></div><div><dt>Expires</dt><dd>{row.expiry_date ?? "No expiry recorded"}</dd></div></dl>
      {dateWarning && <p className={styles.feedback}><strong>Dates need attention:</strong> {dateWarning}</p>}
      {row.decision_reason && <p><strong>Review feedback:</strong> {row.decision_reason}</p>}
      {row.case_id ? <details><summary>View private credential evidence</summary><VerificationEvidence key={`${row.case_id}:${row.status}`} caseId={row.case_id} /></details> : <p>Legacy record: no linked review case. New approval requires a fresh evidence submission.</p>}
      {admin && ["pending","needs_information","approved","expired"].includes(row.status) && <form key={row.status} className="portal-form" onSubmit={e=>void review(e,row)}>
        <fieldset disabled={busy} className={styles.fields}>
          <label>Credential decision<select name="decision" required>{["approved","expired"].includes(row.status) ? <option value="revoked">Revoke credential</option> : <><option value="needs_information">Request more information</option><option value="approved" disabled={Boolean(dateWarning)}>Approve credential{dateWarning ? " — dates not current" : ""}</option><option value="rejected">Reject credential</option></>}</select></label>
          <label>Evidence-based credential reason<textarea name="reason" minLength={5} maxLength={2000} required /></label>
          <label className={styles.check}><input type="checkbox" required />I inspected the evidence and checked the service scope and dates, or documented why this credential must be revoked or cannot be approved.</label>
          <button type="submit">Save credential decision</button>
        </fieldset>
      </form>}
    </article>;})}</div>
    <nav className={styles.pages} aria-label="Credential record pages"><button disabled={!after || busy || loading} onClick={()=>{setLoading(true);void load(null);}}>First page</button><button disabled={!hasMore || busy || loading} onClick={()=>{setLoading(true);void load(rows.at(-1)?.id ?? null);}}>Next page</button></nav>
  </section>;
}
