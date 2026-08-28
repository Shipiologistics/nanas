"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, CalendarDays, Check, ChevronRight, Clock3, Heart, Languages, ListChecks, MapPin, MessageCircle, ShieldCheck, Star, Syringe } from "lucide-react";
import type { DemoUser } from "../../lib/demo-data";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import "./care-style-profile.css";
import "./cloudinary-images.css";

const money = (amount: number) => new Intl.NumberFormat("en-BS", { style: "currency", currency: "BSD", maximumFractionDigits: 0 }).format(amount);
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const safetyLabel = (type: string) => ({background_check:"Nanas background check",social_media_check:"Social media check",enhanced_background_check:"Enhanced background check",motor_vehicle_report:"Motor vehicle report",premium_background_check:"Premium background check"} as Record<string,string>)[type] ?? type.replaceAll("_", " ");
const credentialLabel = (type: string) => ({rn_license:"Registered nurse licence",cpr_first_aid:"CPR and first aid",physiotherapy_license:"Physiotherapy licence"} as Record<string,string>)[type] ?? type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const languageLabel = (language: string) => ({"en-BS":"English (Bahamas)",en:"English","ht":"Haitian Creole","es":"Spanish"} as Record<string,string>)[language] ?? language;
const displayDate = (value?: string) => value ? new Intl.DateTimeFormat("en-BS", { dateStyle: "medium" }).format(new Date(value)) : undefined;

export function CareStyleProviderProfile({ seller, relatedSellers, favorite, onToggleFavorite, onRequestCare, backHref = "/app/buyer/find-care", backLabel = "Find care", relatedHrefBase = "/app/buyer/providers" }: { seller: DemoUser; relatedSellers: DemoUser[]; favorite: boolean; onToggleFavorite: () => void; onRequestCare: (serviceId?: string) => void; backHref?: string; backLabel?: string; relatedHrefBase?: string }) {
  const details = seller.sellerDetails;
  const services = details?.services ?? [];
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === selectedServiceId) ?? services[0];
  const rate = service?.rate ?? 0;
  const location = [details?.locality, details?.island].filter(Boolean).join(", ") || "The Bahamas";
  const firstName = seller.name.split(" ")[0];
  const rating = details?.rating ?? 0;
  const availability = details?.availability ?? [];
  const safetyChecks = details?.safetyChecks ?? [];

  return <div className="care-full-profile">
    <nav className="care-profile-breadcrumb"><Link href={backHref}>← {backLabel}</Link><span>Healthcare seller profile</span></nav>
    <div className="care-profile-layout">
      <aside className="care-profile-summary-card">
        <section className="care-profile-hero-card">
          <div className={`care-profile-avatar ${seller.avatarUrl ? "has-photo" : ""}`} style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined} aria-label={`${seller.name} profile photo`}>{seller.avatarUrl ? null : seller.avatar}<i><BadgeCheck /></i></div>
          <div className="care-profile-identity"><span>Approved individual healthcare seller</span><h1>{seller.name}</h1><p><MapPin />{location}</p><h2>{details?.headline || "Healthcare and care support at home"}</h2></div>
          <button className="care-profile-save" onClick={onToggleFavorite} aria-label={favorite ? "Remove saved seller" : "Save seller"}><Heart className={favorite ? "filled" : ""} /></button>
        </section>
        <section className="care-profile-stat-card"><div><b>{service?.yearsExperience || 0}</b><small>years work experience</small></div><div><b>{rate ? `${money(rate)}/hour` : "Ask"}</b><small>starting rate</small></div></section>
        <div className="care-profile-summary-highlights"><p><Languages /><span><b>Speaks {details?.languages && details.languages.length > 1 ? "multiple languages" : "your language"}</b><small>{firstName} speaks {details?.languages?.map(languageLabel).join(" and ") || "languages available on request"}.</small></span></p><p><ShieldCheck /><span><b>{safetyChecks.some((item) => item.type === "background_check" && item.status === "completed") ? `Nanas background check${displayDate(safetyChecks.find((item) => item.type === "background_check")?.completedAt) ? ` on ${displayDate(safetyChecks.find((item) => item.type === "background_check")?.completedAt)}` : ""}` : "Safety status available"}</b><small>Public screening status is managed by Nanas.</small></span></p></div>
        <button className="care-profile-primary-contact" onClick={() => onRequestCare(service?.id)}>Contact {firstName}</button>
      </aside>

      <main className="care-profile-detail-column">
        {services.length > 1 && <nav className="care-profile-service-tabs" aria-label="Seller services">{services.map((item) => <button className={item.id === service?.id ? "active" : ""} key={item.id} onClick={() => setSelectedServiceId(item.id)}>{item.name}</button>)}</nav>}

        <section className="care-profile-section care-profile-about"><h2>About {firstName}</h2><p className="care-profile-bio">{service?.bio || `${seller.name} personally provides approved ${service?.name.toLowerCase() ?? "healthcare"} support at home. Care requests, messages, quotes and bookings stay connected through Nanas.`}</p>{details?.credentials?.length || service?.capabilities?.length ? <><h3>Credentials</h3><p className="care-profile-credential-note">Nanas marks professional records that have been reviewed. Ask the seller about experience-based qualifications and the exact support included before booking.</p><div className="care-profile-credential-list">{details?.credentials?.map((credential) => <span key={`credential-${credential.type}`}><BadgeCheck /><b>{credentialLabel(credential.type)}</b><small>{credential.issuingBody ? `${credential.issuingBody} · reviewed by Nanas` : "Record reviewed by Nanas"}</small></span>)}{service?.capabilities?.map((capability) => <span key={`capability-${capability}`}><Check /><b>{capability}</b><small>Care qualification for {service.name}</small></span>)}</div></> : null}</section>

        <section className="care-profile-section"><div className="care-profile-section-heading"><div><h2>Reviews</h2><p>Only eligible completed Nanas bookings can create a public review.</p></div><span><Star className="filled" />{rating ? rating.toFixed(1) : "New"}</span></div>{details?.reviewCount ? <div className="care-profile-review-summary"><strong>{rating.toFixed(1)}</strong><div><b>{details.reviewCount} verified reviews</b><p>Public review details appear here from connected booking records.</p></div></div> : <div className="care-profile-empty-review"><Star /><div><b>No reviews yet</b><p>Be the first eligible buyer to leave {firstName} a review.</p></div></div>}</section>

        <section className="care-profile-section"><h2>Services</h2><div className="care-profile-capability-list">{service?.capabilities?.length ? service.capabilities.map((item) => <span key={item}><Check />{item}</span>) : <p>Ask {firstName} about the approved scope for this service.</p>}</div><div className="care-profile-rate-table"><h3>Rates</h3><div><span>Recurring jobs</span><b>{service?.rate ? `${money(service.rate)}${service.rateMax ? `–${money(service.rateMax)}` : ""} / hour` : "Rate on request"}</b></div></div>{service?.additionalHelp?.length ? <div className="care-profile-other-help"><h3>Other ways {firstName} can help</h3>{service.additionalHelp.map((item) => <span key={item}><ListChecks />{item}</span>)}</div> : null}</section>

        <section className="care-profile-section"><div className="care-profile-section-heading"><div><h2>Availability</h2><p>{details?.availabilityUpdatedAt ? `Last updated ${displayDate(details.availabilityUpdatedAt)}` : "Message the seller to confirm current availability."}</p></div><CalendarDays /></div><div className="care-profile-availability-types"><span><Clock3 /><b>Full-time jobs</b><small>30+ hours/week</small></span><span><Clock3 /><b>Part-time jobs</b><small>Less than 30 hours/week</small></span></div><h3>Work hours</h3><div className="care-profile-schedule">{availability.length ? availability.map((rule) => <div key={`${rule.weekday}-${rule.start}`}><b>{weekDays[rule.weekday]}</b><span>{rule.start.slice(0,5)} – {rule.end.slice(0,5)}</span></div>) : weekDays.map((day) => <div key={day}><b>{day}</b><span>Ask about availability</span></div>)}</div><AvailabilityCalendar availability={availability} updatedAt={details?.availabilityUpdatedAt} /><div className="care-profile-availability-note"><Clock3 /><span><b>Message {firstName} to confirm availability</b><small>General work hours do not create a confirmed healthcare booking.</small></span></div></section>

        <section className="care-profile-section care-profile-personal-details">
          <div className="care-profile-section-heading"><div><h2>Profile details</h2><p>Helpful care preferences and health information shared by {firstName}.</p></div><ListChecks /></div>
          <div className="care-profile-detail-cards">
            <article><header><i><Languages /></i><div><h3>Languages</h3><p>Languages {firstName} can use with your household.</p></div></header><div>{details?.languages?.length ? details.languages.map((item) => <span key={item}><Check />{languageLabel(item)}</span>) : <p className="care-profile-detail-empty">Ask about spoken languages.</p>}</div></article>
            <article><header><i><Syringe /></i><div><h3>Vaccinations</h3><p>Vaccination details voluntarily shared for care planning.</p></div></header><div>{details?.vaccinations?.length ? details.vaccinations.map((item) => <span key={item}><Check />{item}</span>) : <p className="care-profile-detail-empty">No vaccination details have been added.</p>}</div></article>
            <article><header><i><ListChecks /></i><div><h3>Additional details</h3><p>Practical preferences that may matter for a booking.</p></div></header><div>{details?.additionalDetails?.length ? details.additionalDetails.map((item) => <span key={item}><Check />{item}</span>) : <p className="care-profile-detail-empty">No additional public details have been added.</p>}</div></article>
          </div>
        </section>

        <section className="care-profile-section"><h2>Safety</h2><p>Private screening results are never published. Buyers see only the status Nanas permits for public display.</p><div className="care-profile-safety-list">{safetyChecks.length ? safetyChecks.map((check) => <article key={check.type}><ShieldCheck /><div><b>{safetyLabel(check.type)}</b><small className={check.status === "completed" ? "complete" : ""}>{check.status === "completed" ? `Completed${displayDate(check.completedAt) ? ` ${displayDate(check.completedAt)}` : ""}` : check.status.replaceAll("_", " ")}</small>{check.summary && <p>{check.summary}</p>}</div></article>) : <article><ShieldCheck /><div><b>Safety screening</b><small>Not on file</small></div></article>}</div></section>

        <section className="care-profile-section"><h2>Communication and booking protection</h2><div className="care-profile-trust-grid"><article><BadgeCheck /><div><b>Identity reviewed</b><p>The seller’s Nanas identity verification state is current.</p></div></article><article><ShieldCheck /><div><b>Approved scope</b><p>Healthcare services remain limited to the seller’s approved credentials.</p></div></article><article><MessageCircle /><div><b>Private coordination</b><p>Exact addresses and care notes stay out of public profile pages.</p></div></article><article><Star /><div><b>Booking-based reviews</b><p>Feedback is tied to eligible completed care.</p></div></article></div></section>
      </main>
    </div>

    {relatedSellers.length > 0 && <section className="care-profile-related"><header><div><span>More approved sellers</span><h2>Continue comparing care.</h2></div><Link href={backHref}>See all sellers</Link></header><div>{relatedSellers.slice(0, 3).map((related) => <Link href={`${relatedHrefBase}/${related.id}`} key={related.id}><span className={related.avatarUrl ? "has-photo" : undefined} style={related.avatarUrl ? { backgroundImage: `url(${related.avatarUrl})` } : undefined}>{related.avatarUrl ? null : related.avatar}</span><div><b>{related.name}</b><small>{related.sellerDetails?.headline || "Approved healthcare seller"}</small><em><Star className="filled" />{related.sellerDetails?.rating?.toFixed(1) || "New"} · From {money(related.sellerDetails?.services[0]?.rate || 0)}/hr</em></div><ChevronRight /></Link>)}</div></section>}
  </div>;
}
