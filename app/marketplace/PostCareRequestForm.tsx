"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { careServices } from "../../lib/public-marketplace";
import { validatePublicRequestDraft } from "../../lib/public-request-draft.mjs";

export function PostCareRequestForm({initialService = "", initialServiceId = ""}: {initialService?: string; initialServiceId?: string}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [service, setService] = useState(careServices.some(item => item.slug === initialService) ? initialService : "");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = Object.fromEntries(data.entries());
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Nassau", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    let draft;
    try { draft = validatePublicRequestDraft(input, today); }
    catch (error) { setError(error instanceof Error ? error.message : "Check the request details."); return; }
    try {
      sessionStorage.setItem("nanas-care-request-draft", JSON.stringify(draft));
      router.push("/auth?next=%2Fapp%2Fbuyer%2Foverview%3FresumeRequest%3D1&intent=post-care-request");
    } catch { setError("Your browser could not save the draft. Enable site storage and try again."); }
  }

  return <form className="mp-form-card" onSubmit={submit}>
    <h2>Tell us about the care</h2>
    <p>Your answers create a private draft. Exact addresses and medical details are never public.</p>
    <p>Times are in The Bahamas (America/Nassau). Visits in this form must end before midnight. You will confirm service coverage after sign-in.</p>
    {error && <p role="alert">{error}</p>}
    <div className="mp-form-grid">
      <input type="hidden" name="serviceId" value={service === initialService ? initialServiceId : ""} />
      <label>Type of support<select name="service" required value={service} onChange={event => setService(event.target.value)}><option value="" disabled>Choose a care or household service</option>{careServices.map((service) => <option value={service.slug} key={service.slug}>{service.name}</option>)}</select></label>
      <label>General area<select name="area" required defaultValue="Nassau & Paradise Island"><option>Nassau & Paradise Island</option><option>Freeport & Lucaya</option><option>Abaco</option><option>Exuma</option><option>Eleuthera</option><option>Other Family Island</option></select></label>
      <label>Preferred date<input name="date" type="date" required /></label>
      <label>Start time<input name="time" type="time" required /></label>
      <label>Estimated hours<input name="hours" min="1" max="24" type="number" defaultValue="3" required /></label>
      <label>Budget in BSD<input name="budget" min="20" max="100000" step="0.01" type="number" placeholder="180" required /></label>
      <label className="wide">Who needs care?<input name="recipient" maxLength={120} placeholder="For example: my mother, an older adult living at home" required /></label>
      <label className="wide">What support would make the visit successful?<textarea name="description" minLength={10} maxLength={900} placeholder="Describe routines, mobility needs, timing, and what a good visit looks like. Avoid diagnoses or private identifiers here." required /></label>
      <button type="submit">Save draft and continue securely →</button>
    </div>
  </form>;
}
