"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  ArrowLeft, BadgeCheck, CalendarDays, Check, ChevronRight, CircleDollarSign, Clock3,
  Heart, HeartHandshake, MapPin, MessageCircle, ShieldCheck, Star, Stethoscope,
} from "lucide-react";
import type { DemoQuote, DemoRequest, DemoUser } from "../../lib/demo-data";
import { requestScheduleDate, requestScheduleSummary } from "../../lib/request-schedule.mjs";
import "./anyjob-targeted.css";
import "./cloudinary-images.css";
export { CareStyleProviderProfile as NanasProviderProfile } from "./CareStyleProviderProfile";

const money = (amount: number) => new Intl.NumberFormat("en-BS", { style: "currency", currency: "BSD" }).format(amount);
const dateTime = (value: string) => new Intl.DateTimeFormat("en-BS", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Nassau" }).format(new Date(value));

type PackageKey = "essential" | "extended" | "ongoing";

export function AnyJobProviderProfile({
  seller,
  relatedSellers,
  favorite,
  onToggleFavorite,
  onRequestCare,
  backHref = "/app/buyer/find-care",
  backLabel = "Find care",
  relatedHrefBase = "/app/buyer/providers",
}: {
  seller: DemoUser;
  relatedSellers: DemoUser[];
  favorite: boolean;
  onToggleFavorite: () => void;
  onRequestCare: (serviceId?: string) => void;
  backHref?: string;
  backLabel?: string;
  relatedHrefBase?: string;
}) {
  const [selectedPackage, setSelectedPackage] = useState<PackageKey>("essential");
  const details = seller.sellerDetails;
  const services = details?.services ?? [];
  const primaryService = services[0];
  const baseRate = primaryService?.rate || 38;
  const rating = details?.rating || 0;
  const packages = useMemo(() => ({
    essential: { label: "Essential", title: "Focused at-home visit", price: baseRate * 2, time: "Up to 2 hours", copy: "One focused visit for a clearly described care or household need.", features: ["Direct care request", "Secure Nanas messaging", "Approved provider review"] },
    extended: { label: "Extended", title: "Half-day care support", price: baseRate * 4, time: "Up to 4 hours", copy: "More time for routines, mobility support, meals, and family updates.", features: ["Priority coordination", "Flexible care checklist", "Visit progress updates"] },
    ongoing: { label: "Ongoing", title: "Recurring care plan", price: baseRate * 8, time: "Custom schedule", copy: "Start a recurring-care conversation and agree each visit before booking.", features: ["Custom schedule planning", "Continuity of care", "Extended family coordination"] },
  }), [baseRate]);
  const activePackage = packages[selectedPackage];
  const location = [details?.locality, details?.island].filter(Boolean).join(", ") || "The Bahamas";
  const completed = details?.completedBookings ?? 0;

  const packageCard = (className: string) => <aside className={`aj-package-card ${className}`}>
    <div className="aj-package-tabs">{(Object.keys(packages) as PackageKey[]).map((key) => <button key={key} className={selectedPackage === key ? "active" : ""} onClick={() => setSelectedPackage(key)}>{packages[key].label}</button>)}</div>
    <div className="aj-package-body">
      <div className="aj-package-price"><div><b>{activePackage.title}</b><p>{activePackage.copy}</p></div><strong>{money(activePackage.price)}</strong></div>
      <div className="aj-package-meta"><span><Clock3 />{activePackage.time}</span><span><ShieldCheck />Protected request flow</span></div>
      <ul>{activePackage.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul>
      <button className="aj-solid-cta" onClick={() => onRequestCare(primaryService?.id)}>Continue</button>
      <p className="aj-package-note">Share the need first. The provider reviews the scope before you accept any quote.</p>
    </div>
  </aside>;

  return <div className="aj-profile-page">
    <nav className="aj-breadcrumb"><Link href={backHref}>{backLabel}</Link><ChevronRight /><span>{primaryService?.name ?? "Care provider"}</span></nav>
    <div className="aj-profile-grid">
      <main>
        <h1>{primaryService?.name ?? "Home healthcare"} services by {seller.name}</h1>
        <div className="aj-profile-byline">
          <span className={`aj-round-avatar ${seller.avatarUrl ? "has-photo" : ""}`} style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined}>{seller.avatarUrl ? null : seller.avatar}</span><b>{seller.name}</b><i /><span><BadgeCheck /> Approved provider</span><i /><span><Star className="filled" />{rating > 0 ? rating.toFixed(1) : "New"} <small>({details?.reviewCount ?? 0} reviews)</small></span>
        </div>
        <div className="aj-profile-media"><Image src="/nanas/provider-home-care.png" alt="A care provider supporting an older adult at home" width={1672} height={941} priority /><button aria-label={favorite ? "Remove saved provider" : "Save provider"} onClick={onToggleFavorite}><Heart className={favorite ? "filled" : ""} /></button></div>
        <div className="aj-media-strip"><Image src="/nanas/provider-home-care.png" alt="Home-care visit" width={480} height={270} /><div><Stethoscope /><span>Approved provider</span></div><div><HeartHandshake /><span>Care at home</span></div><div><ShieldCheck /><span>Verified identity</span></div><div><MessageCircle /><span>Safe coordination</span></div></div>
        {packageCard("aj-package-mobile")}

        <div className="aj-profile-sections">
          <section><h2>About this service</h2><p>{primaryService?.bio || `${seller.name} personally provides approved care or household support at home, with each visit coordinated through Nanas and limited to the services shown on this profile.`}</p><div className="aj-check-grid">{["Identity reviewed by Nanas", "Relevant qualifications reviewed", "Private booking-scoped messages", "Reviews tied to completed care"].map((item) => <span key={item}><Check />{item}</span>)}</div></section>
          <section><h2>What this provider offers</h2><div className="aj-service-pills">{services.length ? services.map((service) => <span key={service.id}>{service.name}<b>{service.rate ? `${money(service.rate)}/hr` : "Rate on request"}</b></span>) : <p>Approved services will appear here once active.</p>}</div></section>
          <section id="seller"><h2>About the provider</h2><article className="aj-about-seller"><div className={`aj-round-avatar large ${seller.avatarUrl ? "has-photo" : ""}`} style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined}>{seller.avatarUrl ? null : seller.avatar}</div><div><h3>{seller.name}</h3><p>{details?.headline || "Approved care provider"}</p><div><span><Star className="filled" />{rating > 0 ? rating.toFixed(1) : "New"}</span><span>{completed} completed care booking{completed === 1 ? "" : "s"}</span><span>{details?.languages?.join(", ") || "Language not specified"}</span></div><button onClick={() => onRequestCare(primaryService?.id)}>Request care from {seller.name.split(" ")[0]}</button></div></article><div className="aj-seller-facts"><div><small>From</small><b>{location}</b></div><div><small>Typical response</small><b>Within a few hours</b></div><div><small>Availability</small><b>Shown before confirmation</b></div><div><small>Starting rate</small><b>{baseRate ? `${money(baseRate)}/hour` : "On request"}</b></div></div></section>
          <section><h2>Frequently asked questions</h2><div className="aj-faq">{[
            ["How do I request this provider?", "Choose a care option, describe the need, and send the private request. You only continue after the provider confirms the scope."],
            ["Can I select this provider directly?", "Yes. Nanas attaches this provider to your request while still checking service, coverage, verification, and availability eligibility."],
            ["Are reviews verified?", "Reviews can only be submitted from completed Nanas care bookings."],
          ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight /></summary><p>{answer}</p></details>)}</div></section>
          <section><div className="aj-section-title"><h2>Reviews</h2><span><Star className="filled" />{rating > 0 ? rating.toFixed(1) : "New"}</span></div><div className="aj-review-summary"><div><strong>{rating > 0 ? rating.toFixed(1) : "New"}</strong><small>{details?.reviewCount ?? 0} verified reviews</small></div><div>{[5,4,3,2,1].map((stars, index) => <span key={stars}><small>{stars} star</small><i><b style={{width: `${rating ? Math.max(4, 86 - index * 20) : 0}%`}} /></i></span>)}</div></div><article className="aj-review-empty"><BadgeCheck /><div><b>Booking-based feedback</b><p>Written review details publish only when available from completed Nanas care bookings. The rating above is calculated from verified booking records.</p></div></article></section>
        </div>
      </main>
      <div className="aj-profile-aside">{packageCard("aj-package-desktop")}<div className="aj-trust-card"><ShieldCheck /><div><b>Booking starts safely</b><p>Share care details first. Exact addresses and private care notes stay protected until the appropriate booking stage.</p></div></div></div>
    </div>
    {relatedSellers.length > 0 && <section className="aj-related"><div><h2>More approved providers</h2><Link href={backHref}>See all providers</Link></div><div>{relatedSellers.slice(0,4).map((related) => <Link href={`${relatedHrefBase}/${related.id}`} key={related.id}><div className="aj-related-visual"><span className={related.avatarUrl ? "has-photo" : undefined} style={related.avatarUrl ? { backgroundImage: `url(${related.avatarUrl})` } : undefined}>{related.avatarUrl ? null : related.avatar}</span><BadgeCheck /></div><h3>{related.name}</h3><p>{related.sellerDetails?.headline || "Approved care provider"}</p><footer><span><Star className="filled" />{(related.sellerDetails?.rating ?? 0).toFixed(1)}</span><b>From {money(related.sellerDetails?.services[0]?.rate || 0)}</b></footer></Link>)}</div></section>}
  </div>;
}

export function NanasCareRequestDetail({
  request,
  viewer,
  querySuffix = "",
  currentUserId,
  busy,
  onSubmitQuote,
  onAcceptQuote,
  onMessage,
}: {
  request: DemoRequest;
  viewer: "buyer" | "seller";
  querySuffix?: string;
  currentUserId: string;
  busy: boolean;
  onSubmitQuote: (event: FormEvent<HTMLFormElement>) => void;
  onAcceptQuote: (quote: DemoQuote) => void;
  onMessage: () => void;
}) {
  const [tab, setTab] = useState<"offers" | "buyer">("offers");
  const existingQuote = request.quotes.find((quote) => quote.sellerId === currentUserId);
  const hasQuoted = Boolean(existingQuote || request.hasQuoted);
  const quoteCount = request.quoteCount ?? request.quotes.length;
  const durationHours = Number(((new Date(request.endsAt).getTime() - new Date(request.startsAt).getTime()) / 3600_000).toFixed(2));
  const recurringSummary = requestScheduleSummary(request);
  const recurringStart = requestScheduleDate(request.schedule?.startDate);
  const recurringEnd = requestScheduleDate(request.schedule?.endDate);
  const backHref = (viewer === "seller" ? "/app/seller/requests" : "/app/buyer/care-requests") + querySuffix;

  return <div className="aj-job-page">
    <Link className="aj-back" href={backHref}><ArrowLeft />Back to {viewer === "seller" ? "care requests" : "my requests"}</Link>
    <div className="aj-job-grid">
      <div className="aj-job-main">
        <section className="aj-job-hero">
          <div className="aj-job-badges"><span>{request.mode === "on_demand" ? "Care soon" : recurringSummary ? "Recurring" : "Scheduled"}</span><span>{request.status}</span>{request.featured && <span>Featured request</span>}<span>{quoteCount} quote{quoteCount === 1 ? "" : "s"}</span></div>
          <h1>{request.service} support in {request.area.split(",")[0]}</h1>
          <div className="aj-buyer-trust"><span><ShieldCheck />Exact address stays private</span><span><HeartHandshake />Care and household services</span></div>
          <div className="aj-job-facts"><div><MapPin /><span><small>General location</small><b>{request.area}</b><em>Exact address remains private</em></span></div><div><CalendarDays /><span><small>{recurringSummary ? "Recurring schedule" : "Care begins"}</small><b>{recurringSummary ?? dateTime(request.startsAt)}</b><em>{recurringSummary ? `${recurringStart ?? "Start date unavailable"}${recurringEnd ? ` – ${recurringEnd}` : " · ongoing"}` : `Ends ${dateTime(request.endsAt)}`}</em></span></div><div><Clock3 /><span><small>{recurringSummary ? "Each proposed visit" : "Estimated workload"}</small><b>{durationHours} hour{durationHours === 1 ? "" : "s"}</b><em>{recurringSummary ? "Confirm every visit before booking" : "One approved provider needed"}</em></span></div></div>
        </section>

        <section className="aj-job-card"><h2>Care request details</h2><p className="aj-job-description">{request.summary}</p><div className="aj-detail-pairs"><div><small>Care category</small><b>{request.service}</b></div><div><small>Request type</small><b>{request.mode === "on_demand" ? "Help as soon as possible" : recurringSummary ? "Recurring care request" : "Scheduled service"}</b></div></div>{recurringSummary && <p className="aj-job-description">Each accepted quote creates one protected visit. Confirm later dates and prices before each booking.</p>}</section>

        <section id="offers" className="aj-job-card aj-insights"><div className="aj-insight-tabs"><button className={tab === "offers" ? "active" : ""} onClick={() => setTab("offers")}>{viewer === "seller" ? "Your visible offers" : "Offers"} <span>{request.quotes.length}</span></button><button className={tab === "buyer" ? "active" : ""} onClick={() => setTab("buyer")}>Buyer activity</button></div>{tab === "offers" ? <div className="aj-offers">{request.quotes.length ? request.quotes.map((quote) => <article key={quote.id}><div className="aj-round-avatar">{quote.sellerName.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><div><div><h3>{quote.sellerName}</h3><BadgeCheck /><span>{quote.status}</span></div><p>{quote.message}</p><small>Provider rate {money(quote.rate)}/hr · Travel {money(quote.travel)}</small></div><aside><small>Buyer total</small><strong>{money(quote.total)}</strong>{viewer === "buyer" && quote.status === "pending" && <button onClick={() => onAcceptQuote(quote)}>Accept quote</button>}</aside></article>) : <div className="aj-no-offers"><CircleDollarSign /><h3>No visible quotes</h3><p>{viewer === "seller" ? "Other providers’ quote details remain private. Submit your own proposal if you have not already quoted." : "Eligible approved providers can quote after reviewing this safe summary."}</p></div>}</div> : <div className="aj-buyer-activity"><p><ShieldCheck />Verified buyer activity totals are not available on this page. Private account and care-recipient information stays hidden.</p></div>}</section>

        {viewer === "seller" && !hasQuoted && <section id="quote" className="aj-job-card aj-quote-form"><div className="aj-section-title"><h2>Make an offer</h2><CircleDollarSign /></div><form onSubmit={onSubmitQuote}><label>Your hourly rate (BSD)<input name="rate" type="number" min="1" defaultValue="38" required /></label><label>Travel fee (BSD)<input name="travel" type="number" min="0" defaultValue="0" required /></label><label className="wide">Message to the buyer<textarea name="message" required maxLength={1200} defaultValue="I am available and have relevant experience for this care need. I will keep you updated throughout the visit." /></label><div className="wide aj-quote-assurance"><ShieldCheck /><span><b>Your quote stays inside Nanas.</b><small>The buyer sees an itemized BSD total and chooses before any simulated payment.</small></span></div><button className="wide aj-solid-cta" disabled={busy} type="submit">{busy ? "Sending quote…" : "Submit care quote"}</button></form></section>}
        {viewer === "seller" && hasQuoted && <section className="aj-offer-sent"><BadgeCheck /><div><h2>Quote already submitted</h2>{existingQuote ? <p>You quoted {money(existingQuote.total)}. Its current status is <b>{existingQuote.status}</b>.</p> : <p>Open your Quotes workspace to review the saved offer.</p>}</div></section>}
      </div>

      <aside className="aj-job-aside"><div className="aj-budget-card"><small>{viewer === "seller" ? "Buyer budget" : "Maximum care budget"}</small><strong>{money(request.budget)}</strong><p>BSD · for the described care visit</p>{viewer === "seller" ? <a href={hasQuoted ? "#offers" : "#quote"}>{hasQuoted ? "Quote sent" : "Make an offer"}</a> : <button onClick={onMessage}><MessageCircle />Message about request</button>}</div><div className="aj-client-card"><h3>Buyer information</h3><div><span className="aj-round-avatar">{request.buyerName.split(" ").map((part) => part[0]).join("").slice(0,2)}</span><div><b>{request.buyerName}</b><small>Nanas buyer</small></div></div><ul><li><ShieldCheck />Exact address stays private</li><li><Star />Booking-based feedback only</li></ul></div><div className="aj-stat-card"><h3>Request statistics</h3><span>Posted<b>{request.createdAt ? dateTime(request.createdAt) : "Not available"}</b></span><span>Status<b>{request.status}</b></span><span>Total quotes<b>{quoteCount}</b></span><span>Care duration<b>{durationHours}h</b></span></div></aside>
    </div>
  </div>;
}

export function DetailNotFound({ backHref, children }: { backHref: string; children: ReactNode }) {
  return <div className="aj-not-found"><HeartHandshake /><h1>That Nanas page is unavailable.</h1><p>{children}</p><Link href={backHref}><ArrowLeft />Go back</Link></div>;
}
