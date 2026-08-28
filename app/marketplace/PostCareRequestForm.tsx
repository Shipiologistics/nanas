"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { careServices } from "../../lib/public-marketplace";

export function PostCareRequestForm() {
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const draft = Object.fromEntries(data.entries());
    sessionStorage.setItem("nanas-care-request-draft", JSON.stringify(draft));
    router.push("/auth?next=/app/buyer/overview&intent=post-care-request");
  }

  return <form className="mp-form-card" onSubmit={submit}>
    <h2>Tell us about the care</h2>
    <p>Your answers create a private draft. Exact addresses and medical details are never public.</p>
    <div className="mp-form-grid">
      <label>Type of support<select name="service" required defaultValue=""><option value="" disabled>Choose a healthcare service</option>{careServices.map((service) => <option value={service.slug} key={service.slug}>{service.name}</option>)}</select></label>
      <label>General area<select name="area" required defaultValue="Nassau & Paradise Island"><option>Nassau & Paradise Island</option><option>Freeport & Lucaya</option><option>Abaco</option><option>Exuma</option><option>Eleuthera</option><option>Other Family Island</option></select></label>
      <label>Preferred date<input name="date" type="date" required /></label>
      <label>Start time<input name="time" type="time" required /></label>
      <label>Estimated hours<input name="hours" min="1" max="24" type="number" defaultValue="3" required /></label>
      <label>Budget in BSD<input name="budget" min="20" step="5" type="number" placeholder="180" required /></label>
      <label className="wide">Who needs care?<input name="recipient" placeholder="For example: my mother, an older adult living at home" required /></label>
      <label className="wide">What support would make the visit successful?<textarea name="description" placeholder="Describe routines, mobility needs, timing, and what a good visit looks like. Avoid diagnoses or private identifiers here." required /></label>
      <button type="submit">Save draft and continue securely →</button>
    </div>
  </form>;
}
