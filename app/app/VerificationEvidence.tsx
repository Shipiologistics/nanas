"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

type Evidence = { id: string; name: string; status: string; uploadedAt: string; issueDate?: string | null; expiryDate?: string | null; mediaType?: string; url?: string; error?: string };

export function VerificationEvidence({ caseId }: { caseId: string }) {
  const [documents, setDocuments] = useState<Evidence[]>([]);
  const [expiresAt, setExpiresAt] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => {
      setDocuments([]);
      setLoaded(false);
      setError("Preview expired. Load evidence again to renew access.");
    }, Math.max(0, expiresAt * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const client = getSupabase();
      const session = client ? await client.auth.getSession() : null;
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in to view verification evidence");
      const response = await fetch("/api/verification/evidence", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }), cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Evidence could not be loaded");
      setDocuments(result.documents);
      setExpiresAt(result.expiresAt);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence could not be loaded");
    } finally { setBusy(false); }
  }
  return <section className="verification-evidence" aria-label="Private verification evidence">
    <p>Private evidence links expire after two minutes. Admin access is recorded. Never approve a document you cannot inspect.</p>
    <button type="button" disabled={busy} onClick={load}>{busy ? "Loading evidence…" : loaded ? "Refresh private evidence" : "Load private evidence"}</button>
    {error && <p role="alert">{error}</p>}
    {loaded && documents.length === 0 && <p>No documents are linked to this verification type.</p>}
    {documents.map(document => <article key={document.id}>
      <strong>{document.name}</strong><small>{document.status.replaceAll("_", " ")} · {new Date(document.uploadedAt).toLocaleString("en-BS", { timeZone: "America/Nassau" })} (Bahamas time)</small>
      <small>Issue date: {document.issueDate ?? "Unavailable"} · Expiry date: {document.expiryDate ?? "Unavailable"}</small>
      {(!document.issueDate || !document.expiryDate) && <p>Dates not shown here do not mean this document never expires. Check the original evidence and request a replacement if it is not current.</p>}
      {document.error && <p role="alert">{document.error}</p>}
      {document.url && document.mediaType === "image" &&
        // Private, expiring originals must not pass through the public image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={document.url} alt={`Verification evidence: ${document.name}`} referrerPolicy="no-referrer" onError={() => setDocuments(items => items.map(item => item.id === document.id ? { ...item, url: undefined, error: "Image could not be loaded. Refresh access or request a replacement." } : item))} />}
      {document.url && <a style={{display:"inline-flex",alignItems:"center",minHeight:44,overflowWrap:"anywhere"}} href={document.url} target="_blank" rel="noopener noreferrer">Open original document</a>}
    </article>)}
  </section>;
}
