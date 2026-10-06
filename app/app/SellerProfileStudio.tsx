"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { BadgeCheck, CalendarDays, Camera, Check, Clock3, FileCheck2, Languages, MapPin, ShieldCheck, Sparkles, Star, Stethoscope, Syringe } from "lucide-react";
import type { DemoUser } from "../../lib/demo-data";
import { formatFromMime, IMAGE_UPLOAD_POLICIES } from "../../lib/cloudinary-policy";
import "./seller-profile-studio.css";

export type SellerProfileDraft = {
  displayName: string;
  avatarPath?: string;
  headline: string;
  languages: string[];
  vaccinations: string[];
  additionalDetails: string[];
  islandId?: string;
  locality: string;
};

type SellerProfileStudioProps = {
  user: DemoUser;
  profile: SellerProfileDraft;
  photoUrl?: string;
  islands: { id: string; name: string }[];
  services: { id: string; name: string; rate: number; rateMax?: number; bio?: string; yearsExperience: number; capabilities: string[]; additionalHelp: string[]; active: boolean }[];
  availability: { id: string; weekday: number; start: string; end: string; active: boolean }[];
  coverage: { id: string; name: string; radius: number; travelFee: number; active: boolean }[];
  verificationApproved: boolean;
  providerApproved: boolean;
  busy?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditServices: () => void;
  onEditAvailability: () => void;
  onEditCoverage: () => void;
  onOpenVerification: () => void;
};

const money = (amount: number) => new Intl.NumberFormat("en-BS", { style: "currency", currency: "BSD", maximumFractionDigits: 0 }).format(amount);
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SellerProfileStudio({ user, profile, photoUrl, islands, services, availability, coverage, verificationApproved, providerApproved, busy = false, onSubmit, onEditServices, onEditAvailability, onEditCoverage, onOpenVerification }: SellerProfileStudioProps) {
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string>();
  const [photoError, setPhotoError] = useState("");
  useEffect(() => () => {
    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
  }, [localPhotoUrl]);
  function previewPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    setPhotoError("");
    const format = file ? formatFromMime(file.type) : null;
    if (file && (!format || !IMAGE_UPLOAD_POLICIES.profile.formats.includes(format) || file.size === 0 || file.size > IMAGE_UPLOAD_POLICIES.profile.maxBytes)) {
      event.currentTarget.value = "";
      setLocalPhotoUrl(undefined);
      setPhotoError("Choose a non-empty JPG, PNG or WebP image no larger than 5 MB.");
      return;
    }
    setLocalPhotoUrl(file ? URL.createObjectURL(file) : undefined);
  }
  const displayedPhotoUrl = localPhotoUrl ?? photoUrl;
  const activeServices = services.filter((item) => item.active);
  const [previewServiceId, setPreviewServiceId] = useState(activeServices[0]?.id ?? "");
  const previewService = activeServices.find((item) => item.id === previewServiceId) ?? activeServices[0];
  const activeAvailability = availability.filter((item) => item.active);
  const activeCoverage = coverage.filter((item) => item.active);
  const serviceProfilesComplete = activeServices.length > 0 && activeServices.length <= 3 && activeServices.every((service) => service.bio && service.bio.length >= 180 && service.capabilities.length > 0);
  const completed = [profile.displayName, profile.headline, profile.languages.length > 0, profile.locality, profile.islandId, profile.additionalDetails.length > 0, serviceProfilesComplete, activeAvailability.length > 0, activeCoverage.length > 0, verificationApproved].filter(Boolean).length;
  const completion = Math.round((completed / 10) * 100);
  const location = [profile.locality, islands.find((item) => item.id === profile.islandId)?.name].filter(Boolean).join(", ") || "The Bahamas";
  const initials = (profile.displayName || user.name).split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "NS";
  const rate = previewService?.rate ?? 0;
  const publicBadges = user.sellerDetails?.badges ?? [];

  return <div className="seller-profile-studio">
    <section className="seller-profile-progress">
      <div><span>Public profile readiness</span><strong>{completion}%</strong></div>
      <progress value={completion} max="100" />
      <p>Buyers see only approved public details. Credentials, documents and private identity information stay in verification.</p>
    </section>

    <div className="seller-profile-studio-grid">
      <form className="seller-profile-builder" onSubmit={onSubmit}>
        <header><div><span>Profile builder</span><h2>Create the profile buyers compare.</h2><p>Identity details are shared across your profile. Each care or household service keeps its own biography, experience, capabilities and rate range.</p></div><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save identity details"}</button></header>

        <fieldset>
          <legend><span>1</span><div><b>Public identity</b><small>Your name, profile photo and Bahamas location.</small></div></legend>
          <div className="seller-photo-field">
            <div className={`seller-photo-preview ${displayedPhotoUrl ? "has-photo" : ""}`} style={displayedPhotoUrl ? { backgroundImage: `url(${displayedPhotoUrl})` } : undefined}>{displayedPhotoUrl ? null : initials}{providerApproved && <i aria-label="Approved provider"><BadgeCheck /></i>}</div>
            <label><Camera /><span><b>Profile photo</b><small>JPG, PNG or WebP · maximum 5 MB · preview before upload</small></span><input name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={previewPhoto} disabled={busy} /></label>
          </div>
          {photoError && <p role="alert">{photoError}</p>}
          <div className="seller-profile-form-grid">
            <label>Public display name<input name="displayName" required minLength={2} maxLength={80} defaultValue={profile.displayName || user.name} /></label>
            <label>Professional headline<input name="headline" required minLength={10} maxLength={120} defaultValue={profile.headline} placeholder="Registered nurse · compassionate home care" /></label>
            <label>Island<select name="islandId" required defaultValue={profile.islandId ?? ""}><option value="" disabled>Choose an island</option>{islands.map((island) => <option key={island.id} value={island.id}>{island.name}</option>)}</select></label>
            <label>Town or locality<input name="locality" required minLength={2} maxLength={100} defaultValue={profile.locality} placeholder="Nassau" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>2</span><div><b>Communication and personal details</b><small>These details apply to every service profile.</small></div></legend>
          <label>Languages<input name="languages" required defaultValue={profile.languages.join(", ")} placeholder="English, Bahamian Creole" /><small>Separate up to 12 languages with commas.</small></label>
          <div className="seller-profile-form-grid compact">
            <label>Vaccinations<textarea name="vaccinations" maxLength={800} defaultValue={profile.vaccinations.join(", ")} placeholder="COVID-19 vaccinated, Influenza vaccinated" /><small>Self-reported and shown separately from verified safety checks.</small></label>
            <label>Additional details<textarea name="additionalDetails" maxLength={1000} defaultValue={profile.additionalDetails.join(", ")} placeholder="Does not smoke, Has reliable transportation, Comfortable with pets" /><small>Separate public details with commas.</small></label>
          </div>
        </fieldset>

        <section className="seller-service-profile-callout"><Sparkles /><div><b>Create 1–3 service-specific profiles</b><p>Every category needs its own substantial About section, years of experience, rate range, care qualifications and additional help. Buyers switch between these profiles without losing your shared identity and safety information.</p></div><button type="button" onClick={onEditServices}>Edit service profiles</button></section>

        <footer><span><ShieldCheck />Changes remain subject to Nanas verification and moderation.</span><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save identity details"}</button></footer>
      </form>

      <aside className="seller-profile-live-preview">
        <header><span>Buyer preview</span><small>Updates after you save</small></header>
        <div className="seller-preview-identity">
          <div className={`seller-preview-avatar ${photoUrl ? "has-photo" : ""}`} style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}>{photoUrl ? null : initials}{providerApproved && <i aria-label="Approved provider"><BadgeCheck /></i>}</div>
          <span>{providerApproved ? "Approved care provider" : "Provider preview · not approved"}</span>
          <h2>{profile.displayName || user.name}</h2>
          <p><MapPin />{location}</p>
          <b>{profile.headline || "Add a professional headline"}</b>
          <div>{verificationApproved && <i><ShieldCheck />Credentials reviewed</i>}{publicBadges.slice(0, 2).map((badge) => <i key={badge}><BadgeCheck />{badge}</i>)}</div>
        </div>
        {activeServices.length > 1 && <nav className="seller-preview-service-tabs" aria-label="Preview a service profile">{activeServices.map((service) => <button type="button" className={previewService?.id === service.id ? "active" : ""} key={service.id} onClick={() => setPreviewServiceId(service.id)}>{service.name}</button>)}</nav>}
        <div className="seller-preview-facts"><span><b>{previewService?.yearsExperience || 0}</b><small>years experience</small></span><span><b>{rate ? `${money(rate)}/hr` : "Add rate"}</b><small>starting rate</small></span><span><b>{user.sellerDetails?.rating?.toFixed(1) || "New"}</b><small>{user.sellerDetails?.reviewCount ?? 0} reviews</small></span></div>
        <section><h3>About {profile.displayName.split(" ")[0] || "you"} · {previewService?.name ?? "service"}</h3><p>{previewService?.bio || "Add a dedicated biography for this care or household service."}</p></section>
        {previewService?.capabilities.length ? <section><h3>Services</h3><div className="seller-preview-capabilities">{previewService.capabilities.map((item) => <span key={item}><Check />{item}</span>)}</div></section> : null}
        <section><h3>Can help with</h3><div className="seller-preview-services">{activeServices.length ? activeServices.map((service) => <span key={service.id}><Stethoscope /><b>{service.name}</b><small>{money(service.rate)}/hour</small></span>) : <p>Add at least one approved care or household service and rate.</p>}</div></section>
        <section><h3>Languages</h3><p><Languages />{profile.languages.join(", ") || "Add the languages you speak"}</p></section>
        {profile.vaccinations.length > 0 && <section><h3>Vaccinations</h3><p><Syringe />{profile.vaccinations.join(", ")}</p></section>}
      </aside>
    </div>

    <section className="seller-profile-linked-sections">
      <article><Stethoscope /><div><span>Care and household service profiles · 1–3 allowed</span><b>{serviceProfilesComplete ? `${activeServices.length} complete service profile${activeServices.length === 1 ? "" : "s"}` : "Needs attention"}</b><p>Controls each substantial biography, years, qualifications, additional help and BSD rate range.</p></div><button onClick={onEditServices}>Manage services</button></article>
      <article><CalendarDays /><div><span>Availability</span><b>{activeAvailability.length ? activeAvailability.map((item) => dayNames[item.weekday]).join(", ") : "Needs attention"}</b><p>Buyers receive guidance, while exact dates are confirmed privately.</p></div><button onClick={onEditAvailability}>Set availability</button></article>
      <article><MapPin /><div><span>Coverage</span><b>{activeCoverage.length ? activeCoverage.map((item) => item.name).join(", ") : "Needs attention"}</b><p>Determines where matching care requests and travel terms apply.</p></div><button onClick={onEditCoverage}>Manage coverage</button></article>
      <article><FileCheck2 /><div><span>Verification</span><b>{verificationApproved ? "Approved" : "Action required"}</b><p>Identity and relevant service qualifications remain private and admin-reviewed.</p></div><button onClick={onOpenVerification}>View verification</button></article>
      <article><Clock3 /><div><span>Buyer-visible trust</span><b>System managed</b><p>Response rate, completed care, ratings and badges cannot be self-edited.</p></div><span className="seller-system-badge"><Check />Protected</span></article>
      <article><Star /><div><span>Reviews</span><b>{user.sellerDetails?.reviewCount ?? 0} verified reviews</b><p>Only eligible completed Nanas bookings can create a public review.</p></div><span className="seller-system-badge"><Check />Booking-linked</span></article>
    </section>
  </div>;
}
