"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, CalendarDays, Check, ChevronRight, Clock3, Heart, Languages, ListChecks, MapPin, MessageCircle, ShieldCheck, Star, Syringe } from "lucide-react";
import type { DemoUser } from "../../lib/demo-data";
import "./care-style-discovery.css";

const money = (amount: number) => new Intl.NumberFormat("en-BS", { style: "currency", currency: "BSD", maximumFractionDigits: 0 }).format(amount);
const minimumRate = (seller: DemoUser) => {
  const rates = seller.sellerDetails?.services.map((service) => service.rate).filter((rate) => rate > 0) ?? [];
  return rates.length ? Math.min(...rates) : 0;
};
const selectedServiceFor = (seller: DemoUser, preferredServiceName?: string) => seller.sellerDetails?.services.find((service) => service.name === preferredServiceName) ?? seller.sellerDetails?.services[0];
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const checkLabel = (type: string) => ({background_check:"Nanas background check",social_media_check:"Social media check",enhanced_background_check:"Enhanced background check",motor_vehicle_report:"Motor vehicle report",premium_background_check:"Premium background check"} as Record<string,string>)[type] ?? type.replaceAll("_", " ");
const languageLabel = (language: string) => ({ "en-BS": "English (Bahamas)", en: "English", es: "Spanish", fr: "French", ht: "Haitian Creole" } as Record<string, string>)[language] ?? language;

export function CareSellerResultCard({ seller, active, favorite, onFocus, onFavorite, profileHref, onProfile, preferredServiceName }: { seller: DemoUser; active: boolean; favorite: boolean; onFocus: () => void; onFavorite: () => void; profileHref: string; onProfile: () => void; preferredServiceName?: string }) {
  const details = seller.sellerDetails;
  const service = selectedServiceFor(seller, preferredServiceName);
  const rate = service?.rate ?? minimumRate(seller);
  return <article className={`care-result-card ${active ? "active" : ""}`}>
    <button className="care-result-main" onClick={onFocus}>
      <span className={`care-result-avatar ${seller.avatarUrl ? "has-photo" : ""}`} style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined} aria-label={`${seller.name} profile photo`}>{seller.avatarUrl ? null : seller.avatar}<i><BadgeCheck /></i></span>
      <span className="care-result-copy">
        <span className="care-result-name"><b>{seller.name}</b><small><MapPin />{[details?.locality, details?.island].filter(Boolean).join(", ") || "The Bahamas"}</small></span>
        <span className="care-result-experience">{service?.yearsExperience ? `${service.yearsExperience} years of ${service.name.toLowerCase()} experience` : `${details?.completedBookings ?? 0} completed care bookings`}</span>
        <span className="care-result-badges"><i><ShieldCheck />Credentials reviewed</i>{details?.badges?.slice(0, 1).map((badge) => <i key={badge}><BadgeCheck />{badge}</i>)}</span>
        <span className="care-result-bio">{service?.bio || `${seller.name} provides approved ${service?.name.toLowerCase() ?? "healthcare"} support at home through Nanas.`}</span>
        <span className="care-result-traits">{service?.capabilities?.slice(0, 2).map((capability) => <i key={capability}><Check />{capability}</i>)}{details?.languages?.[0] && <i><Languages />{languageLabel(details.languages[0])}</i>}</span>
      </span>
      <span className="care-result-rate"><b>{rate ? money(rate) : "Ask"}</b><small>{rate ? "per hour" : "for rate"}</small></span>
    </button>
    <button className="care-result-save" onClick={onFavorite} aria-label={favorite ? `Remove ${seller.name} from saved sellers` : `Save ${seller.name}`}><Heart className={favorite ? "filled" : ""} /></button>
    <Link className="care-result-profile-link" href={profileHref} onClick={onProfile}>View full profile <ChevronRight /></Link>
  </article>;
}

export function CareSellerPreview({ seller, favorite, onFavorite, onRequest, profileHref, onProfile, preferredServiceName }: { seller: DemoUser; favorite: boolean; onFavorite: () => void; onRequest: (serviceId?: string) => void; profileHref: string; onProfile: () => void; preferredServiceName?: string }) {
  const details = seller.sellerDetails;
  const services = details?.services ?? [];
  const preferredService = selectedServiceFor(seller, preferredServiceName);
  const [selectedServiceId, setSelectedServiceId] = useState(preferredService?.id ?? "");
  const service = services.find((item) => item.id === selectedServiceId) ?? preferredService ?? services[0];
  const rate = service?.rate ?? minimumRate(seller);
  const location = [details?.locality, details?.island].filter(Boolean).join(", ") || "The Bahamas";
  const firstName = seller.name.split(" ")[0];
  const availability = details?.availability ?? [];
  return <aside className="care-preview-panel" aria-label={`${seller.name} profile preview`}>
    <div className="care-preview-sticky-action"><button onClick={() => onRequest(service?.id)}>Request {service?.name.toLowerCase() ?? "care"} from {firstName}</button></div>
    <header className="care-preview-tools"><Link href={profileHref} onClick={onProfile}>Open full profile <ChevronRight /></Link><button onClick={onFavorite} aria-label={favorite ? "Remove saved seller" : "Save seller"}><Heart className={favorite ? "filled" : ""} /></button></header>
    <section className="care-preview-identity"><div className={`care-preview-avatar ${seller.avatarUrl ? "has-photo" : ""}`} style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined} aria-label={`${seller.name} profile photo`}>{seller.avatarUrl ? null : seller.avatar}<i><BadgeCheck /></i></div><div><span>Approved healthcare seller</span><h2>{seller.name}</h2><p><MapPin />{location}</p></div></section>
    {services.length > 1 && <nav className="care-preview-service-tabs" aria-label="Seller healthcare services">{services.map((item) => <button className={item.id === service?.id ? "active" : ""} key={item.id} onClick={() => setSelectedServiceId(item.id)}>{item.name}</button>)}</nav>}
    <section className="care-preview-facts"><div><b>{service?.yearsExperience || 0}</b><small>years experience</small></div><div><b>{rate ? `${money(rate)}/hr` : "Ask"}</b><small>starting rate</small></div><div><b>{details?.rating ? details.rating.toFixed(1) : "New"}</b><small>{details?.reviewCount ?? 0} reviews</small></div></section>
    <section className="care-preview-section"><h3>About {firstName}</h3><p className="care-preview-about">{service?.bio || `${seller.name} provides approved ${service?.name.toLowerCase() ?? "healthcare"} support at home through Nanas.`}</p></section>
    <section className="care-preview-section"><h3>Services</h3><div className="care-preview-capability-list">{service?.capabilities?.length ? service.capabilities.map((capability) => <span key={capability}><Check />{capability}</span>) : <p>Ask {firstName} about the approved scope for this service.</p>}</div><div className="care-preview-rate-range"><span>Recurring jobs</span><b>{service?.rate ? `${money(service.rate)}${service.rateMax ? `–${money(service.rateMax)}` : ""} / hour` : "Rate on request"}</b></div></section>
    {service?.additionalHelp?.length ? <section className="care-preview-section"><h3>Other ways {firstName} can help</h3><div className="care-preview-capability-list secondary">{service.additionalHelp.map((item) => <span key={item}><ListChecks />{item}</span>)}</div></section> : null}
    <section className="care-preview-section"><h3>Trust and communication</h3><ul className="care-preview-trust"><li><BadgeCheck /><span><b>Identity reviewed</b><small>Nanas account identity check completed</small></span></li><li><ShieldCheck /><span><b>Healthcare credentials reviewed</b><small>Approved services are shown on this profile</small></span></li><li><Languages /><span><b>Languages</b><small>{details?.languages?.map(languageLabel).join(", ") || "Ask the seller"}</small></span></li><li><MessageCircle /><span><b>{details?.responseRate ? `${details.responseRate}% response rate` : "Secure messaging"}</b><small>Coordinate care without publishing contact details</small></span></li></ul></section>
    <section className="care-preview-section"><div className="care-preview-heading"><h3>Reviews</h3><span><Star className="filled" />{details?.rating ? details.rating.toFixed(1) : "New"}</span></div><p>{details?.reviewCount ? `${details.reviewCount} reviews from eligible Nanas bookings.` : "No published reviews yet. Reviews can only follow eligible completed care bookings."}</p></section>
    <section className="care-preview-section"><h3>Availability</h3><p>Message {firstName} to confirm availability for your care dates.</p><div className="care-preview-availability-summary"><span><CalendarDays /><b>Full-time care</b><small>30+ hours/week</small></span><span><Clock3 /><b>Part-time care</b><small>Less than 30 hours/week</small></span></div><div className="care-preview-work-hours">{availability.length ? availability.map((rule) => <div key={`${rule.weekday}-${rule.start}`}><b>{weekDays[rule.weekday]}</b><span>{rule.start.slice(0,5)} – {rule.end.slice(0,5)}</span></div>) : <p>Availability is confirmed through a care request.</p>}</div></section>
    {details?.vaccinations?.length ? <section className="care-preview-section"><h3>Vaccinations</h3><div className="care-preview-detail-list">{details.vaccinations.map((item) => <span key={item}><Syringe />{item}</span>)}</div></section> : null}
    {details?.additionalDetails?.length ? <section className="care-preview-section"><h3>Additional details</h3><div className="care-preview-detail-list">{details.additionalDetails.map((item) => <span key={item}><Check />{item}</span>)}</div></section> : null}
    <section className="care-preview-section"><h3>Safety</h3><div className="care-preview-safety-list">{details?.safetyChecks?.length ? details.safetyChecks.map((check) => <div key={check.type}><ShieldCheck /><span><b>{checkLabel(check.type)}</b><small>{check.status === "completed" ? `Completed${check.completedAt ? ` ${new Intl.DateTimeFormat("en-BS", { dateStyle: "medium" }).format(new Date(check.completedAt))}` : ""}` : check.status.replaceAll("_", " ")}</small></span></div>) : <div><ShieldCheck /><span><b>Background screening</b><small>Ask Nanas about the current public status</small></span></div>}</div></section>
    <Link className="care-preview-full-link" href={profileHref} onClick={onProfile}>See complete profile <ChevronRight /></Link>
  </aside>;
}
