import Link from "next/link";
import type { CSSProperties } from "react";
import {
  careServices,
  publicCareRequests,
  publicProviders,
  type PublicCareService,
} from "../../lib/public-marketplace";
import { MarketplacePage } from "./MarketplaceShell";
import { PostCareRequestForm } from "./PostCareRequestForm";

function Hero({
  kicker,
  title,
  copy,
  image,
  mobileImage,
  mobileTitle,
  mobileCopy,
  mobilePrimaryLabel,
  mobileSecondaryLabel,
  primary = { href: "/post-care-request", label: "Post a care request" },
  secondary = { href: "/find-care", label: "Find a care seller" },
}: {
  kicker: string;
  title: string;
  copy: string;
  image: string;
  mobileImage: string;
  mobileTitle?: string;
  mobileCopy?: string;
  mobilePrimaryLabel?: string;
  mobileSecondaryLabel?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section
      className="mp-hero"
      style={
        {
          "--hero-image": `url('${image}')`,
          "--hero-mobile-image": `url('${mobileImage}')`,
        } as CSSProperties
      }
    >
      <div>
        <span className="mp-kicker">{kicker}</span>
        <h1>
          <span className="mp-hero-desktop-only">{title}</span>
          <span className="mp-hero-mobile-only">{mobileTitle ?? title}</span>
        </h1>
        <p>
          <span className="mp-hero-desktop-only">{copy}</span>
          <span className="mp-hero-mobile-only">{mobileCopy ?? copy}</span>
        </p>
        <div className="mp-hero-actions">
          <Link className="mp-primary" href={primary.href}>
            <span className="mp-hero-desktop-only">{primary.label} →</span>
            <span className="mp-hero-mobile-only">
              {mobilePrimaryLabel ?? primary.label} →
            </span>
          </Link>
          <Link className="mp-secondary" href={secondary.href}>
            <span className="mp-hero-desktop-only">{secondary.label}</span>
            <span className="mp-hero-mobile-only">
              {mobileSecondaryLabel ?? secondary.label}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

const serviceHeroImages: Record<string, string> = {
  "senior-care": "/nanas/hero-services-wide.png",
  "home-nursing": "/nanas/hero-find-care-wide.png",
  "post-hospital-care": "/nanas/hero-care-requests-wide.png",
  "respite-care": "/nanas/hero-how-it-works-wide.png",
  "disability-care": "/nanas/hero-safety-wide.png",
  physiotherapy: "/nanas/hero-seller-wide.png",
};

const serviceHeroMobileImages: Record<string, string> = {
  "senior-care": "/nanas/hero-services-mobile.webp",
  "home-nursing": "/nanas/hero-find-care-mobile.webp",
  "post-hospital-care": "/nanas/hero-care-requests-mobile.webp",
  "respite-care": "/nanas/hero-how-it-works-mobile.webp",
  "disability-care": "/nanas/hero-safety-mobile.webp",
  physiotherapy: "/nanas/hero-seller-mobile.webp",
};

function SectionHead({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="mp-section-head">
      <div>
        <span className="mp-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {copy && <p>{copy}</p>}
    </div>
  );
}

function ServiceGrid({
  services = careServices,
}: {
  services?: PublicCareService[];
}) {
  return (
    <div className="mp-service-grid">
      {services.map((service) => (
        <Link
          className="mp-service-card"
          href={`/services/${service.slug}`}
          key={service.slug}
          style={
            {
              "--card-bg":
                service.accent === "teal"
                  ? "#b9deda"
                  : service.accent === "sand"
                    ? "#f1dfc5"
                    : service.accent === "coral"
                      ? "#efd1c8"
                      : "#dcefeb",
            } as CSSProperties
          }
        >
          <span>
            {service.name
              .split(" ")
              .map((word) => word[0])
              .join("")}
          </span>
          <h3>{service.name}</h3>
          <p>
            {service.short}. {service.description}
          </p>
          <footer>
            <span>
              From <b>${service.rate}</b> BSD/hr
            </span>
            <strong>Explore →</strong>
          </footer>
        </Link>
      ))}
    </div>
  );
}

function ProviderGrid({
  providers = publicProviders,
}: {
  providers?: typeof publicProviders;
}) {
  return (
    <div className="mp-provider-grid">
      {providers.map((provider) => (
        <Link
          className="mp-provider-card"
          href={`/providers/${provider.id}`}
          key={provider.id}
        >
          <div className="mp-provider-photo">
            <span>{provider.avatar}</span>
            <i>✓ VERIFIED</i>
          </div>
          <div className="mp-provider-body">
            <h3>{provider.name}</h3>
            <p>{provider.sellerDetails?.headline}</p>
            <div className="mp-provider-meta">
              <span>
                ★ <b>{provider.sellerDetails?.rating}</b> (
                {provider.sellerDetails?.reviewCount})
              </span>
              <span>
                from <b>${provider.sellerDetails?.services[0]?.rate}</b>/hr
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CTA({
  title,
  copy,
  href = "/post-care-request",
  label = "Post care request",
}: {
  title: string;
  copy: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="mp-container mp-cta">
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <Link className="mp-primary" href={href}>
        {label} →
      </Link>
    </section>
  );
}

export function ServicesPage() {
  return (
    <MarketplacePage>
      <main>
        <Hero
          image="/nanas/hero-services-wide.png"
          mobileImage="/nanas/hero-services-mobile.webp"
          kicker="Healthcare across The Bahamas"
          title="Care for every day."
          copy="Explore trusted individual caregivers for everyday support, recovery, respite, mobility, and nursing visits."
          mobileTitle="Everyday care."
          mobileCopy="Browse trusted everyday support."
          mobilePrimaryLabel="Post care"
          mobileSecondaryLabel="Find sellers"
        />
        <section className="mp-container mp-section">
          <SectionHead
            kicker="Browse care"
            title="Choose the support that fits real life."
            copy="Each page explains what the service can cover, indicative rates, verified sellers, and how to post a useful care request."
          />
          <ServiceGrid />
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="Flexible by design"
              title="Book one visit or build continuity."
            />
            <div className="mp-steps">
              <article className="mp-step">
                <span>01</span>
                <h3>Focused visit</h3>
                <p>
                  Arrange a defined visit for an appointment, recovery check-in,
                  mobility session, or short care need.
                </p>
              </article>
              <article className="mp-step">
                <span>02</span>
                <h3>Half-day support</h3>
                <p>
                  Give a family caregiver breathing room while a trusted seller
                  continues familiar routines at home.
                </p>
              </article>
              <article className="mp-step">
                <span>03</span>
                <h3>Recurring care</h3>
                <p>
                  Invite the same approved seller to quote for a repeating
                  schedule and build a dependable rhythm.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="mp-container mp-long-copy">
          <h2>Healthcare first. Always.</h2>
          <div>
            <p>
              Nanas is exclusively for healthcare and care support delivered by
              individual sellers. There are no contractors, business profiles,
              shift-job rosters, or unrelated household gigs.
            </p>
            <p>
              Profiles show approved services, review history, credentials where
              relevant, general location, availability, and transparent rates so
              families can compare people with confidence.
            </p>
          </div>
        </section>
        <CTA
          title="Not sure which service to choose?"
          copy="Start with what the person needs. Your care request can be refined before any booking is confirmed."
        />
      </main>
    </MarketplacePage>
  );
}

export function ServiceDetailPage({ slug }: { slug: string }) {
  const service = careServices.find((item) => item.slug === slug);
  if (!service)
    return (
      <MarketplacePage>
        <main className="mp-container mp-page-title">
          <span className="mp-kicker">Service unavailable</span>
          <h1>We could not find that healthcare service.</h1>
          <Link className="mp-inline-link" href="/services">
            Browse all services →
          </Link>
        </main>
      </MarketplacePage>
    );
  const matching = publicProviders.filter((provider) =>
    provider.sellerDetails?.services.some((item) => item.id === service.slug),
  );
  return (
    <MarketplacePage>
      <main>
        <Hero
          image={
            serviceHeroImages[service.slug] ?? "/nanas/hero-services-wide.png"
          }
          mobileImage={
            serviceHeroMobileImages[service.slug] ??
            "/nanas/hero-services-mobile.webp"
          }
          kicker={`${service.name} · from $${service.rate} BSD/hr`}
          title={`${service.name}, arranged around real life.`}
          copy="Compare approved sellers, rates, availability, and experience before you request care."
          mobileTitle={`${service.name} at home.`}
          mobileCopy="Compare rates and availability."
          mobilePrimaryLabel="Post request"
          mobileSecondaryLabel="Find sellers"
          primary={{
            href: `/post-care-request?service=${service.slug}`,
            label: `Post a ${service.name.toLowerCase()} request`,
          }}
        />
        <section className="mp-container mp-section">
          <SectionHead
            kicker="Shape the brief"
            title="Choose the support you need."
            copy="Share only the practical details sellers need to decide whether the request fits their experience, availability, and approved scope."
          />
          <div className="mp-need-grid">
            {service.needs.map((need, index) => (
              <article key={need}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{need}</h3>
                <p>
                  Add timing, frequency, and preferences when you create the
                  private care brief.
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="Included on Nanas"
              title="Clarity before a family commits."
            />
            <div className="mp-steps">
              {service.includes.slice(0, 3).map((item, index) => (
                <article className="mp-step" key={item}>
                  <span>0{index + 1}</span>
                  <h3>{item}</h3>
                  <p>
                    Shown clearly in the request, seller response, or booking
                    record so both sides know what was agreed.
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mp-container mp-section">
          <SectionHead
            kicker="Available sellers"
            title={`Meet people offering ${service.name.toLowerCase()}.`}
            copy="Open a full profile to review experience, approved services, badges, rates, availability, and booking-based reviews."
          />
          <ProviderGrid
            providers={matching.length ? matching : publicProviders.slice(0, 3)}
          />
        </section>
        <section className="mp-container mp-long-copy">
          <h2>A useful request gets useful responses.</h2>
          <div>
            <p>
              Describe the routine, general area, preferred date, duration,
              access needs, and the outcome you want from the visit. Keep
              diagnoses, exact addresses, and private identifiers out of the
              public description.
            </p>
            <div className="mp-faq">
              <details open>
                <summary>
                  Can I request recurring {service.name.toLowerCase()}?
                </summary>
                <p>
                  Yes. Add the preferred days and frequency to the brief.
                  Sellers can respond with their availability and a clear quote.
                </p>
              </details>
              <details>
                <summary>When do I share the exact address?</summary>
                <p>
                  Only after an appropriate seller is selected and the booking
                  reaches the secure confirmation stage.
                </p>
              </details>
              <details>
                <summary>Is the displayed rate guaranteed?</summary>
                <p>
                  No. It is an indicative starting rate. The final BSD quote
                  depends on timing, duration, scope, and seller availability.
                </p>
              </details>
            </div>
          </div>
        </section>
        <CTA
          title={`Ready to find ${service.name.toLowerCase()}?`}
          copy="Create a clear request in minutes, then compare responses from approved individual healthcare sellers."
        />
      </main>
    </MarketplacePage>
  );
}

export function FindCarePage({
  filters = { service: "all", area: "all", sort: "recommended" },
}: {
  filters?: { service: string; area: string; sort: string };
}) {
  const providers = publicProviders
    .filter((provider) => {
      const details = provider.sellerDetails;
      const serviceMatch =
        filters.service === "all" ||
        details?.services.some((service) => service.id === filters.service);
      const areaMatch =
        filters.area === "all" ||
        `${details?.locality ?? ""} ${details?.island ?? ""}`
          .toLowerCase()
          .includes(filters.area.toLowerCase());
      return serviceMatch && areaMatch;
    })
    .sort((left, right) => {
      if (filters.sort === "highest-rated")
        return (right.sellerDetails?.rating ?? 0) -
          (left.sellerDetails?.rating ?? 0);
      if (filters.sort === "lowest-rate") {
        const lowest = (provider: (typeof publicProviders)[number]) =>
          Math.min(
            ...(provider.sellerDetails?.services.map((service) => service.rate) ?? [Infinity]),
          );
        return lowest(left) - lowest(right);
      }
      return (right.sellerDetails?.completedBookings ?? 0) -
        (left.sellerDetails?.completedBookings ?? 0);
    });
  return (
    <MarketplacePage>
      <main>
        <Hero
          image="/nanas/hero-find-care-wide.png"
          mobileImage="/nanas/hero-find-care-mobile.webp"
          kicker="Find healthcare sellers"
          title="Find care you trust."
          copy="Compare profiles, rates, availability, experience, and verified reviews."
          mobileTitle="Find trusted care."
          mobileCopy="Compare verified seller profiles."
          mobilePrimaryLabel="Post request"
          mobileSecondaryLabel="Browse sellers"
        />
        <section className="mp-container mp-section">
          <SectionHead
            kicker="Advanced healthcare seller filters"
            title="Explore verified healthcare profiles."
            copy="Every card opens a complete profile page—never a popup—so rates, qualifications, services, badges, and reviews have room to breathe."
          />
          <form className="mp-filterbar" action="/find-care">
            <select name="service" aria-label="Service" defaultValue={filters.service}>
              <option value="all">All healthcare services</option>
              {careServices.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.name}
                </option>
              ))}
            </select>
            <select name="area" aria-label="Area" defaultValue={filters.area}>
              <option value="all">All areas</option>
              <option value="nassau">Nassau</option>
              <option value="freeport">Freeport</option>
              <option value="abaco">Abaco</option>
            </select>
            <select name="sort" aria-label="Sort" defaultValue={filters.sort}>
              <option value="recommended">Recommended</option>
              <option value="highest-rated">Highest rated</option>
              <option value="lowest-rate">Lowest hourly rate</option>
            </select>
            <button type="submit">Search sellers</button>
          </form>
          <ProviderGrid providers={providers} />
          {!providers.length && (
            <div className="mp-empty-state">
              <h3>No sellers match these filters.</h3>
              <p>Try another service or area.</p>
            </div>
          )}
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="Compare with confidence"
              title="Profiles designed for care decisions."
            />
            <div className="mp-steps">
              <article className="mp-step">
                <span>01</span>
                <h3>Read the full story</h3>
                <p>
                  Review experience, service scope, languages, location, rates,
                  badges, and real booking history.
                </p>
              </article>
              <article className="mp-step">
                <span>02</span>
                <h3>Shortlist people</h3>
                <p>
                  Save profiles that fit the care recipient’s needs before
                  starting a secure conversation.
                </p>
              </article>
              <article className="mp-step">
                <span>03</span>
                <h3>Request care</h3>
                <p>
                  Send a structured brief and compare clear responses without
                  publishing private medical information.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="mp-container mp-section">
          <SectionHead
            kicker="Explore by service"
            title="Start with the care need."
          />
          <ServiceGrid services={careServices.slice(0, 3)} />
        </section>
        <CTA
          title="Prefer sellers to come to you?"
          copy="Post one care request and let suitable healthcare sellers respond with availability and a BSD quote."
        />
      </main>
    </MarketplacePage>
  );
}

export function CareRequestsPage() {
  const selected = publicCareRequests[0];
  return (
    <MarketplacePage>
      <main>
        <Hero
          image="/nanas/hero-care-requests-wide.png"
          mobileImage="/nanas/hero-care-requests-mobile.webp"
          kicker="Open care requests"
          title="Care work that matters."
          copy="Browse clear requests from families across The Bahamas."
          mobileTitle="Care work nearby."
          mobileCopy="Browse requests across The Bahamas."
          mobilePrimaryLabel="Sign in to quote"
          mobileSecondaryLabel="Become a seller"
          primary={{
            href: "/auth?next=/app/seller/jobs",
            label: "Sign in to quote",
          }}
          secondary={{
            href: "/become-a-seller",
            label: "Become a seller",
          }}
        />
        <section className="mp-container mp-request-section">
          <form className="mp-filterbar" action="/care-requests">
            <select name="service">
              <option>All care services</option>
              {careServices.map((service) => (
                <option key={service.slug}>{service.name}</option>
              ))}
            </select>
            <select name="area">
              <option>All areas</option>
              <option>Nassau & Paradise Island</option>
              <option>Freeport & Lucaya</option>
            </select>
            <select name="when">
              <option>Any date</option>
              <option>This week</option>
              <option>Next week</option>
            </select>
            <button>Search requests</button>
          </form>
          <div className="mp-request-layout">
            <div className="mp-request-list">
              {publicCareRequests.map((request, index) => (
                <Link
                  className={`mp-request-card ${index === 0 ? "active" : ""}`}
                  href={`/care-requests/${request.slug}`}
                  key={request.slug}
                >
                  <header>
                    <span>{request.service}</span>
                    <b>${request.budget} BSD</b>
                  </header>
                  <h2>{request.title}</h2>
                  <p>{request.description}</p>
                  <div className="mp-request-facts">
                    <span>⌖ {request.area}</span>
                    <span>◷ {request.when}</span>
                    <span>{request.hours} hours</span>
                    <span>
                      {request.quotes} quote{request.quotes === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <aside className="mp-request-preview">
              <span className="mp-kicker">Request preview</span>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
              <div className="mp-pills">
                {selected.needs.map((need) => (
                  <span key={need}>✓ {need}</span>
                ))}
              </div>
              <div className="mp-fact-grid">
                <div>
                  <small>General area</small>
                  <b>{selected.area}</b>
                </div>
                <div>
                  <small>Preferred time</small>
                  <b>{selected.when}</b>
                </div>
                <div>
                  <small>Duration</small>
                  <b>{selected.hours} hours</b>
                </div>
                <div>
                  <small>Buyer budget</small>
                  <b>${selected.budget} BSD</b>
                </div>
              </div>
              <Link
                className="mp-dark-button"
                href={`/care-requests/${selected.slug}`}
              >
                View full request →
              </Link>
            </aside>
          </div>
        </section>
        <CTA
          title="Provide healthcare through Nanas."
          copy="Create an individual seller profile, submit the checks for your services, and respond to suitable care requests."
          href="/become-a-seller"
          label="Become a seller"
        />
      </main>
    </MarketplacePage>
  );
}

export function CareRequestDetailPage({ slug }: { slug: string }) {
  const request = publicCareRequests.find((item) => item.slug === slug);
  if (!request)
    return (
      <MarketplacePage>
        <main className="mp-container mp-page-title">
          <span className="mp-kicker">Request unavailable</span>
          <h1>This care request is no longer available.</h1>
          <Link className="mp-inline-link" href="/care-requests">
            Browse open requests →
          </Link>
        </main>
      </MarketplacePage>
    );
  return (
    <MarketplacePage>
      <main className="mp-container">
        <div className="mp-job-breadcrumb">
          <Link href="/care-requests">← All care requests</Link>
          <span>Open · {request.service}</span>
        </div>
        <section className="mp-job-layout">
          <article className="mp-job-main">
            <span className="mp-kicker">Posted care request</span>
            <h1>{request.title}</h1>
            <p className="mp-job-location">
              ⌖ {request.area} · Exact address shared after confirmation
            </p>
            <div className="mp-job-facts">
              <div>
                <small>Preferred time</small>
                <b>{request.when}</b>
              </div>
              <div>
                <small>Estimated duration</small>
                <b>{request.hours} hours</b>
              </div>
              <div>
                <small>Responses</small>
                <b>
                  {request.quotes} quote{request.quotes === 1 ? "" : "s"}
                </b>
              </div>
              <div>
                <small>Care type</small>
                <b>{request.service}</b>
              </div>
            </div>
            <section>
              <h2>About this care request</h2>
              <p>{request.description}</p>
            </section>
            <section>
              <h2>Support requested</h2>
              <div className="mp-pills">
                {request.needs.map((need) => (
                  <span key={need}>✓ {need}</span>
                ))}
              </div>
            </section>
            <section>
              <h2>What the buyer will confirm privately</h2>
              <ul>
                <li>Exact address and access instructions</li>
                <li>Relevant routine and safe handover notes</li>
                <li>Emergency contact and visit preferences</li>
                <li>Final scope, start time, duration, and price</li>
              </ul>
            </section>
            <div className="mp-privacy-note">
              <b>Privacy by design</b>
              <p>
                No diagnosis, exact address, phone number, or personal medical
                record is shown in this public preview.
              </p>
            </div>
          </article>
          <aside className="mp-job-aside">
            <span>Buyer budget</span>
            <strong>
              ${request.budget} <small>BSD</small>
            </strong>
            <p>
              Final price is agreed in the seller response and confirmed before
              booking.
            </p>
            <Link className="mp-dark-button" href="/auth?next=/app/seller/jobs">
              Sign in to send a quote →
            </Link>
            <Link className="mp-light-button" href="/become-a-seller">
              Become a Nanas seller
            </Link>
            <hr />
            <b>Buyer trust signals</b>
            <ul>
              <li>✓ Identity verified</li>
              <li>✓ Payment method ready</li>
              <li>✓ General area confirmed</li>
            </ul>
          </aside>
        </section>
        <section className="mp-section">
          <SectionHead
            kicker="Similar care requests"
            title="More ways to make a difference."
          />
          <div className="mp-request-list mp-three-col">
            {publicCareRequests
              .filter((item) => item.slug !== slug)
              .slice(0, 3)
              .map((item) => (
                <Link
                  className="mp-request-card"
                  href={`/care-requests/${item.slug}`}
                  key={item.slug}
                >
                  <header>
                    <span>{item.service}</span>
                    <b>${item.budget} BSD</b>
                  </header>
                  <h2>{item.title}</h2>
                  <p>
                    {item.area} · {item.when}
                  </p>
                </Link>
              ))}
          </div>
        </section>
      </main>
    </MarketplacePage>
  );
}

export function PostCareRequestPage() {
  return (
    <MarketplacePage>
      <main>
        <section className="mp-container mp-page-title">
          <span className="mp-kicker">Guided buyer flow</span>
          <h1>Tell us what care would make today easier.</h1>
          <p>
            Answer a few straightforward questions. Nanas saves the request as a
            private draft, then asks you to sign in before anything can be sent
            to sellers.
          </p>
        </section>
        <section className="mp-container mp-form-shell">
          <PostCareRequestForm />
          <aside className="mp-side-note">
            <span className="mp-kicker">Before you start</span>
            <h3>Share needs, not private records.</h3>
            <ul>
              <li>Use a general area, never an exact public address.</li>
              <li>
                Describe routines and desired outcomes without publishing
                diagnoses.
              </li>
              <li>You can review and edit every answer after sign-in.</li>
              <li>Nothing is booked or charged from this first step.</li>
            </ul>
            <Link className="mp-inline-link" href="/how-it-works">
              See how Nanas works →
            </Link>
          </aside>
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="What happens next"
              title="A calm path from need to care."
            />
            <div className="mp-steps">
              <article className="mp-step">
                <span>01</span>
                <h3>Review your request</h3>
                <p>
                  Confirm the service, schedule, general location, duration,
                  needs, and budget before publishing.
                </p>
              </article>
              <article className="mp-step">
                <span>02</span>
                <h3>Compare responses</h3>
                <p>
                  Review individual sellers’ profiles, availability, message,
                  and full BSD quote.
                </p>
              </article>
              <article className="mp-step">
                <span>03</span>
                <h3>Confirm securely</h3>
                <p>
                  Select one seller, agree the final scope, and use the
                  simulated protected booking flow.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </MarketplacePage>
  );
}

export function HowItWorksPage() {
  return (
    <MarketplacePage>
      <main>
        <Hero
          image="/nanas/hero-how-it-works-wide.png"
          mobileImage="/nanas/hero-how-it-works-mobile.webp"
          kicker="Nanas, step by step"
          title="Care, step by step."
          copy="A clear path from a real need to a confirmed care visit."
          mobileTitle="Care made simple."
          mobileCopy="From need to confirmed visit."
          mobilePrimaryLabel="Post request"
          mobileSecondaryLabel="Find sellers"
        />
        <section className="mp-container mp-section">
          <SectionHead
            kicker="For buyers"
            title="From a care need to the right person."
          />
          <div className="mp-process-grid">
            {[
              [
                "01",
                "Describe the care",
                "Use the guided questions to share the service, area, timing, routines, duration, and budget.",
              ],
              [
                "02",
                "Discover and compare",
                "Browse profiles or receive responses with rates, experience, badges, availability, and reviews.",
              ],
              [
                "03",
                "Talk privately",
                "Ask practical questions in secure Nanas messaging without exposing personal contact details.",
              ],
              [
                "04",
                "Confirm a booking",
                "Agree the scope and price, simulate protected payment, and keep the visit record in one place.",
              ],
              [
                "05",
                "Complete the visit",
                "Buyer and seller use the booking check-in and completion flow.",
              ],
              [
                "06",
                "Share a verified review",
                "Eligible completed bookings unlock a double-blind review window.",
              ],
            ].map(([n, t, c]) => (
              <article key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{c}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="For sellers"
              title="A professional way to find suitable care work."
            />
            <div className="mp-steps">
              <article className="mp-step">
                <span>01</span>
                <h3>Build one individual profile</h3>
                <p>
                  Add your approved services, experience, rates, availability,
                  languages, credentials, and general service area.
                </p>
              </article>
              <article className="mp-step">
                <span>02</span>
                <h3>Complete verification</h3>
                <p>
                  Submit identity, service eligibility, and healthcare
                  credentials for admin review before public visibility.
                </p>
              </article>
              <article className="mp-step">
                <span>03</span>
                <h3>Respond with clarity</h3>
                <p>
                  Browse matching requests and send a message, availability, and
                  full quote within your approved scope.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="mp-container mp-long-copy">
          <h2>Built for three roles only.</h2>
          <div>
            <p>
              <b>Buyers</b> are people arranging healthcare or care support.{" "}
              <b>Sellers</b> are individual people approved to provide those
              services. <b>Admins</b> operate trust, safety, KYC, moderation,
              payments, and platform support.
            </p>
            <p>
              There are no contractor accounts, companies, agency pages, generic
              gigs, or shift-employment boards. Every marketplace surface stays
              centred on healthcare Nanas.
            </p>
            <div className="mp-faq">
              <details open>
                <summary>Can buyers browse before signing in?</summary>
                <p>
                  Yes. Public service, profile, and care-request previews are
                  available to guests. Sign-in is required to message, save,
                  post, quote, or book.
                </p>
              </details>
              <details>
                <summary>Can one account buy and sell?</summary>
                <p>
                  The product supports buyer and seller capabilities, but seller
                  features remain locked until the required verification is
                  approved.
                </p>
              </details>
              <details>
                <summary>Does Nanas provide emergency healthcare?</summary>
                <p>
                  No. Nanas is not an emergency service and must not be used for
                  urgent or life-threatening situations.
                </p>
              </details>
            </div>
          </div>
        </section>
        <CTA
          title="Start with the care you need."
          copy="The guided request flow takes only a few minutes and keeps private information out of the public marketplace."
        />
      </main>
    </MarketplacePage>
  );
}

export function SafetyPage() {
  return (
    <MarketplacePage>
      <main>
        <Hero
          image="/nanas/hero-safety-wide.png"
          mobileImage="/nanas/hero-safety-mobile.webp"
          kicker="Trust and safety"
          title="Trust is a process, not a badge."
          copy="Know what has been checked before you choose or book care."
          mobileTitle="Know what's checked."
          mobileCopy="See every completed safety check."
          mobilePrimaryLabel="Verified sellers"
          mobileSecondaryLabel="How it works"
          primary={{ href: "/find-care", label: "Browse verified sellers" }}
          secondary={{ href: "/how-it-works", label: "See how it works" }}
        />
        <section className="mp-container mp-section">
          <SectionHead
            kicker="Layered protection"
            title="Designed around healthcare responsibility."
          />
          <div className="mp-need-grid">
            {[
              [
                "Identity",
                "Government ID and account details are reviewed before seller approval.",
              ],
              [
                "Credentials",
                "Healthcare credentials are reviewed for applicable services and carry an expiry state.",
              ],
              [
                "Background status",
                "The platform records requested, pending, approved, expired, or rejected checks.",
              ],
              [
                "Private messaging",
                "Contact details and exact addresses stay out of public discovery surfaces.",
              ],
              [
                "Booking record",
                "Scope, price, messages, check-in, completion, disputes, and refunds stay connected.",
              ],
              [
                "Admin moderation",
                "Admins can review KYC, read reported conversations, suspend, ban, and preserve audit history.",
              ],
            ].map(([title, copy], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="Clear status labels"
              title="See what has—and has not—been checked."
            />
            <div className="mp-steps">
              <article className="mp-step">
                <span>✓</span>
                <h3>Verified</h3>
                <p>
                  The named check is approved and current. It never implies a
                  guarantee of conduct or outcome.
                </p>
              </article>
              <article className="mp-step">
                <span>…</span>
                <h3>Pending</h3>
                <p>
                  Documents or information are still under review and the
                  related seller capability remains restricted.
                </p>
              </article>
              <article className="mp-step">
                <span>!</span>
                <h3>Expired or restricted</h3>
                <p>
                  The credential or account state needs action. Affected
                  services cannot receive new bookings.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="mp-container mp-long-copy">
          <h2>If something feels wrong, pause.</h2>
          <div>
            <p>
              Use report and dispute tools from the relevant profile, message,
              quote, or booking. Nanas admins can review connected evidence and
              apply restrictions while an issue is assessed.
            </p>
            <div className="mp-emergency">
              <b>Nanas is not an emergency service.</b>
              <p>
                For urgent or life-threatening situations, contact the locally
                approved emergency service or healthcare provider immediately.
              </p>
            </div>
            <div className="mp-faq">
              <details open>
                <summary>Are all reviews tied to bookings?</summary>
                <p>
                  Yes. Public reviews require an eligible completed booking and
                  use a double-blind publishing window.
                </p>
              </details>
              <details>
                <summary>Can an admin access messages?</summary>
                <p>
                  Only authorised admins can access conversation records for
                  moderation, safety, support, dispute, and legal purposes, with
                  the action captured in audit history.
                </p>
              </details>
              <details>
                <summary>Where are images stored?</summary>
                <p>
                  The local product uses private Supabase Storage buckets with
                  access policies. A later Cloudinary migration can preserve the
                  same application-level permissions.
                </p>
              </details>
            </div>
          </div>
        </section>
      </main>
    </MarketplacePage>
  );
}

export function BecomeSellerPage() {
  return (
    <MarketplacePage>
      <main>
        <Hero
          image="/nanas/hero-seller-wide.png"
          mobileImage="/nanas/hero-seller-mobile.webp"
          kicker="For individual healthcare sellers"
          title="Let families find your care."
          copy="Build one verified profile and respond to suitable care requests."
          mobileTitle="Let families find you."
          mobileCopy="Build a profile and find families."
          mobilePrimaryLabel="Create account"
          mobileSecondaryLabel="Browse requests"
          primary={{
            href: "/auth?role=seller",
            label: "Create a seller account",
          }}
          secondary={{ href: "/care-requests", label: "Browse care requests" }}
        />
        <section className="mp-container mp-section">
          <SectionHead
            kicker="One calm workspace"
            title="Everything needed to provide care professionally."
          />
          <div className="mp-need-grid">
            {[
              [
                "A complete profile",
                "Present your experience, bio, location, languages, services, rates, credentials, badges, and reviews.",
              ],
              [
                "Matching requests",
                "Explore healthcare requests by service, general area, date, duration, and budget.",
              ],
              [
                "Clear quotes",
                "Respond with availability, message, scope, hourly or fixed price, and expiry.",
              ],
              [
                "Secure conversations",
                "Keep buyer questions and practical visit details connected to the care request.",
              ],
              [
                "Booking and wallet",
                "Track simulated payments, pending funds, earnings, fees, refunds, and withdrawals.",
              ],
              [
                "Trust history",
                "Build verified reviews and badges from eligible completed care bookings.",
              ],
            ].map(([title, copy], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mp-band">
          <div className="mp-container">
            <SectionHead
              kicker="Approval journey"
              title="Qualify before you provide care."
            />
            <div className="mp-steps">
              <article className="mp-step">
                <span>01</span>
                <h3>Create your profile</h3>
                <p>
                  Add accurate personal, service, rate, experience, location,
                  language, and availability information.
                </p>
              </article>
              <article className="mp-step">
                <span>02</span>
                <h3>Submit checks</h3>
                <p>
                  Upload identity documents and the credentials required for
                  each healthcare service you want to offer.
                </p>
              </article>
              <article className="mp-step">
                <span>03</span>
                <h3>Admin review</h3>
                <p>
                  Nanas reviews KYC and service eligibility. Approved services
                  become visible on the public profile.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="mp-container mp-long-copy">
          <h2>This is not a generic gig board.</h2>
          <div>
            <p>
              Nanas sellers are individual healthcare and care-support
              providers. The marketplace does not support agencies, business
              accounts, unrelated household services, contractors, or
              shift-employment rosters.
            </p>
            <p>
              Only respond to requests that fit your approved services,
              professional scope, experience, and availability.
            </p>
            <div className="mp-faq">
              <details open>
                <summary>What can I offer?</summary>
                <p>
                  Senior care, approved home nursing, post-hospital support,
                  respite care, disability support, physiotherapy, and future
                  healthcare services explicitly enabled by Nanas.
                </p>
              </details>
              <details>
                <summary>How do I get paid?</summary>
                <p>
                  The current local product simulates protected payment, wallet
                  balances, platform fees, refunds, and withdrawals end to end.
                  A live payment processor is a later production integration.
                </p>
              </details>
              <details>
                <summary>Can my account be suspended?</summary>
                <p>
                  Yes. Admins can restrict, suspend, or ban accounts for expired
                  credentials, policy violations, safety concerns, fraud, or
                  other documented reasons.
                </p>
              </details>
            </div>
          </div>
        </section>
        <CTA
          title="Ready to build your Nanas profile?"
          copy="Start your individual seller application and complete verification for the healthcare services you provide."
          href="/auth?role=seller"
          label="Join as a seller"
        />
      </main>
    </MarketplacePage>
  );
}
