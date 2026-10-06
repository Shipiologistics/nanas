"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  House,
  MessageCircle,
  PawPrint,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarketplaceHeader } from "./marketplace/MarketplaceShell";
import "./marketplace-home.css";

const services = [
  {
    slug: "senior-care",
    name: "Senior care",
    description:
      "Everyday support, companionship, mobility help, and respectful care for older adults.",
    mark: "SC",
    tone: "mint",
    image: "/nanas/hero-safety.png",
    meta: "Companionship, mobility, daily routines",
  },
  {
    slug: "child-care",
    name: "Child care",
    description:
      "Trusted sitters, nannies, after-school support, and family help for children.",
    mark: "CC",
    tone: "teal",
    image: "/nanas/hero-home-wide.png",
    meta: "Babysitting, nanny care, after-school help",
  },
  {
    slug: "home-healthcare",
    name: "Home healthcare",
    description:
      "Health-focused support at home, from nursing visits to recovery and wellness check-ins.",
    mark: "HH",
    tone: "sand",
    image: "/nanas/provider-home-care.png",
    meta: "Nursing, recovery, wellness visits",
  },
  {
    slug: "housekeeping",
    name: "Housekeeping",
    description:
      "Reliable home help for cleaning, errands, organizing, laundry, and practical household routines.",
    mark: "HK",
    tone: "sky",
    image: "/nanas/hero-care-requests.png",
    meta: "Cleaning, errands, laundry, home help",
  },
  {
    slug: "tutoring",
    name: "Tutoring",
    description:
      "Patient academic support, test prep, homework help, and confidence-building sessions.",
    mark: "TU",
    tone: "lilac",
    image: "/nanas/hero-how-it-works.png",
    meta: "Homework, test prep, learning support",
  },
  {
    slug: "pet-care",
    name: "Pet care",
    description:
      "Pet sitters, walkers, feeding visits, check-ins, and steady help while you are away.",
    mark: "PC",
    tone: "coral",
    image: "/nanas/hero-find-care.png",
    meta: "Sitting, walking, feeding, check-ins",
  },
];

const popularCategories = [
  {
    code: "senior_care",
    name: "Senior care",
    examples: "Companion · Hands-on",
    icon: HeartHandshake,
  },
  {
    code: "adult_care",
    name: "Home healthcare",
    examples: "Nursing · Recovery",
    icon: Accessibility,
  },
  {
    code: "child_care",
    name: "Child care",
    examples: "Babysitter · Nanny",
    icon: Users,
  },
  {
    code: "housekeeping",
    name: "Housekeeping",
    examples: "Cleaning · Errands",
    icon: House,
  },
  {
    code: "tutoring",
    name: "Tutoring",
    examples: "Math · Test prep",
    icon: GraduationCap,
  },
  {
    code: "pet_care",
    name: "Pet care",
    examples: "Sitter · Walker",
    icon: PawPrint,
  },
];

const careSearchSuggestions = [
  { value: "Child care", category: "child_care" },
  { value: "Babysitter", category: "child_care" },
  { value: "Nanny", category: "child_care" },
  { value: "Daycare centers", category: "child_care" },
  { value: "Special needs child care", category: "child_care" },
  { value: "Senior care", category: "senior_care" },
  { value: "Senior companion", category: "senior_care" },
  { value: "Hands-on senior care", category: "senior_care" },
  { value: "Live-in senior care", category: "senior_care" },
  { value: "Home healthcare", category: "adult_care" },
  { value: "Home nursing", category: "adult_care" },
  { value: "Post-hospital care", category: "adult_care" },
  { value: "Adult care", category: "adult_care" },
  { value: "Adult companion", category: "adult_care" },
  { value: "Hands-on adult care", category: "adult_care" },
  { value: "Live-in adult care", category: "adult_care" },
  { value: "Pet care", category: "pet_care" },
  { value: "Pet sitter", category: "pet_care" },
  { value: "Dog walker", category: "pet_care" },
  { value: "Pet trainer", category: "pet_care" },
  { value: "Pet groomer", category: "pet_care" },
  { value: "Housekeeping", category: "housekeeping" },
  { value: "House cleaner", category: "housekeeping" },
  { value: "Personal assistant", category: "housekeeping" },
  { value: "Errands and odd jobs", category: "housekeeping" },
  { value: "Tutoring", category: "tutoring" },
  { value: "Math tutor", category: "tutoring" },
  { value: "Science tutor", category: "tutoring" },
  { value: "Test prep tutor", category: "tutoring" },
];

const providers = [
  {
    initials: "AM",
    name: "Alicia M.",
    role: "Registered nurse",
    location: "Nassau, New Providence",
    rating: "4.9",
    reviews: 42,
    bookings: 64,
    price: 38,
    service: "Home healthcare",
    availability: "Available tomorrow",
    bio: "Eight years of home nursing experience with a focus on older adults, recovery support, and calm family communication.",
    badges: ["Identity verified", "RN credential", "Highly rated"],
    color: "avatar-deep",
    image: "/nanas/provider-home-care.png",
    imageAlt: "A Nanas provider preparing care notes during an in-home visit",
  },
  {
    initials: "MD",
    name: "Marcus D.",
    role: "Home health aide",
    location: "Freeport, Grand Bahama",
    rating: "4.8",
    reviews: 31,
    bookings: 49,
    price: 25,
    service: "Senior care",
    availability: "Available this week",
    bio: "Patient, practical support for daily routines, mobility, appointments, and companionship at home.",
    badges: ["Identity verified", "Background checked", "Reliable responder"],
    color: "avatar-soft",
    image: "/nanas/hero-seller.png",
    imageAlt: "A Nanas provider smiling in a calm home care setting",
  },
  {
    initials: "SR",
    name: "Simone R.",
    role: "Physiotherapist",
    location: "Nassau, New Providence",
    rating: "5.0",
    reviews: 27,
    bookings: 37,
    price: 52,
    service: "Home healthcare",
    availability: "Next opening Friday",
    bio: "Home-based rehabilitation and mobility support designed around each patient’s goals and comfort.",
    badges: ["Identity verified", "PT credential", "Highly rated"],
    color: "avatar-warm",
    image: "/nanas/hero-how-it-works.png",
    imageAlt: "A Nanas physiotherapy provider supporting a care plan at home",
  },
];

const howSteps = [
  {
    Icon: ClipboardCheck,
    title: "Tell us what you need",
    copy: "Choose the service, area, timing, and the needs that matter for the care recipient.",
  },
  {
    Icon: ShieldCheck,
    title: "Compare verified providers",
    copy: "Review experience, rates, availability, badges, and booking-backed reviews.",
  },
  {
    Icon: CalendarCheck,
    title: "Book with confidence",
    copy: "Confirm the visit, pay through Nanas, and keep every update in one calm place.",
  },
  {
    Icon: MessageCircle,
    title: "Message securely",
    copy: "Ask practical questions before care starts and keep the conversation tied to the booking.",
  },
];

const featureHighlights = [
  {
    title: "Nanas Match",
    copy: "Tell us what you need and let Nanas help find a suitable provider, especially when you do not know where to start.",
  },
  {
    title: "Senior Care Advisor",
    copy: "Not sure what type of care Mom or Dad needs? Talk to a Nanas care advisor before posting your request.",
  },
  {
    title: "My Nanas favorites",
    copy: "Save trusted providers so recurring help, future requests, and family decisions are easier next time.",
  },
  {
    title: "Safer booking tools",
    copy: "Recurring bookings, emergency contacts, visit updates, and anti-bypass reminders keep care coordinated inside Nanas.",
  },
  {
    title: "Gift of care",
    copy: "A future gift-card style option for family and friends who want to contribute to care or household help.",
  },
];

export default function NanasHome() {
  const router = useRouter();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("Nassau, New Providence");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [suggestionPosition, setSuggestionPosition] = useState({
    top: 0,
    left: 0,
    width: 360,
  });

  const matchingSuggestions = useMemo(() => {
    const query = service.trim().toLowerCase();
    return careSearchSuggestions
      .filter((item) => !query || item.value.toLowerCase().includes(query))
      .slice(0, 6);
  }, [service]);

  const rankedProviders = useMemo(() => {
    const direct = providers.filter((provider) => provider.service === service);
    return direct.length
      ? [
          ...direct,
          ...providers.filter((provider) => provider.service !== service),
        ]
      : providers;
  }, [service]);

  useEffect(() => {
    if (!suggestionsOpen) return;

    function positionSuggestions() {
      const input = searchInputRef.current;
      if (!input) return;
      const label = input.closest("label");
      const anchor = label?.getBoundingClientRect() ?? input.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 32);
      const left = Math.max(
        16,
        Math.min(anchor.left, window.innerWidth - width - 16),
      );
      setSuggestionPosition({ top: anchor.bottom + 8, left, width });
    }

    positionSuggestions();
    window.addEventListener("resize", positionSuggestions);
    window.addEventListener("scroll", positionSuggestions, true);
    return () => {
      window.removeEventListener("resize", positionSuggestions);
      window.removeEventListener("scroll", positionSuggestions, true);
    };
  }, [suggestionsOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = service.trim();
    const selected = careSearchSuggestions.find(
      (item) => item.value.toLowerCase() === query.toLowerCase(),
    )?.category;
    const parameters = new URLSearchParams({ area: location });
    if (selected) parameters.set("category", selected);
    if (query) parameters.set("search", query);
    router.push(`/find-care?${parameters.toString()}`);
  }

  return (
    <main className="nanas-home">
      <MarketplaceHeader />

      <div className="home-hero-shell">
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> Trusted care across The Bahamas
            </div>
            <h1>
              Trusted care, <em>close to home.</em>
            </h1>
            <p className="hero-subtitle">
              Trusted help is just a few clicks away.
            </p>

            <fieldset className="hero-mode-toggle">
              <legend>Choose search mode</legend>
              <button type="button" aria-pressed="true">
                <span aria-hidden="true" /> Find Care
              </button>
              <Link href="/post-care-request">
                <span aria-hidden="true" /> Post a request
              </Link>
            </fieldset>

            <div className="home-search-overlay">
              <form
            className="care-search"
            aria-label="Find care and household services"
            onSubmit={submitSearch}
          >
            <label className="care-search-query">
              <span>I&apos;m looking for</span>
              <input
                ref={searchInputRef}
                type="search"
                value={service}
                onChange={(event) => {
                  setService(event.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setSuggestionsOpen(false)}
                aria-label="Care or household service"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="care-search-suggestion-list"
                aria-expanded={suggestionsOpen}
                placeholder="Senior care, nanny, pet…"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Near</span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                aria-label="Location"
              />
            </label>
            <button className="care-search-submit" type="submit">
              <span className="care-search-submit-label">Find Care</span>
              <Search aria-hidden="true" />
            </button>
              </form>

              <div
                className="hero-popular-searches"
                aria-label="Popular care searches"
              >
                <span>Popular:</span>
                {popularCategories.slice(0, 5).map((item) => (
                  <Link
                    key={item.code}
                    href={`/find-care?category=${item.code}`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>

              <Link className="hero-custom-request" href="/post-care-request">
                <span aria-hidden="true">⊕</span> Request custom care
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section
        className="service-strip popular-category-strip"
        aria-label="Popular Nanas care categories"
      >
        {popularCategories.map((item) => (
          <Link
            href={`/app/buyer/overview?newRequest=1&category=${item.code}&step=1`}
            key={item.code}
          >
            <span className="popular-category-icon">
              <item.icon />
            </span>
            <b>{item.name}</b>
            <small>{item.examples}</small>
          </Link>
        ))}
      </section>

      <section className="section care-section" id="care">
        <div className="section-heading heading-row">
          <div>
            <div className="eyebrow">
              <span /> Care built around people
            </div>
            <h2>
              Services that feel
              <br />
              personal from the start.
            </h2>
          </div>
          <div className="home-heading-copy">
            <p>
              Find trusted people for the things that matter most: senior care,
              child care, home healthcare, housekeeping, tutoring, pet care and
              more across The Bahamas.
            </p>
            <Link href="/services">
              Explore all services <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="service-grid">
          {services.map((item) => (
            <Link
              className="service-card"
              href={`/services/${item.slug}`}
              key={item.name}
            >
              <span className="service-card-media">
                <Image
                  alt=""
                  fill
                  sizes="(max-width: 680px) 100vw, (max-width: 1050px) 50vw, 33vw"
                  src={item.image}
                />
                <span className={`service-mark ${item.tone}`}>{item.mark}</span>
              </span>
              <span className="service-card-copy">
                <span className="service-card-meta">{item.meta}</span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span className="round-arrow" aria-hidden="true">
                <ArrowRight />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-request-section">
        <div className="request-photo">
          <Image
            alt="A family reviewing care options together on Nanas"
            fill
            sizes="(max-width: 980px) 100vw, 48vw"
            src="/nanas/hero-care-requests-wide.png"
          />
        </div>
        <div className="request-copy">
          <div className="eyebrow">
            <span /> Need something specific?
          </div>
          <h2>Post once. Let trusted providers respond.</h2>
          <p>
            For care that does not fit a quick search, buyers can describe the
            timing, location, needs, and budget. Providers only see requests
            that match the services they are approved to offer.
          </p>
          <div className="request-points">
            <span>Custom schedules</span>
            <span>Private messaging</span>
            <span>Payment-protected booking</span>
          </div>
          <Link href="/post-care-request">
            Post a care request <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section results-section" id="care-results">
        <div className="results-topline">
          <div>
            <div className="eyebrow">
              <span /> Sample provider profiles
            </div>
            <h2>Trusted people for care and household help.</h2>
          </div>
          <Link href="/find-care">
            View all providers <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="profile-grid">
          {rankedProviders.map((provider) => (
            <article className="profile-card" key={provider.name}>
              <div className={`profile-photo ${provider.color}`}>
                <Image
                  alt={provider.imageAlt}
                  fill
                  sizes="(max-width: 680px) 100vw, (max-width: 1050px) 50vw, 33vw"
                  src={provider.image}
                />
                <span>{provider.initials}</span>
                <div className="profile-availability">
                  <i /> {provider.availability}
                </div>
              </div>
              <div className="profile-body">
                <div className="profile-line">
                  <div>
                    <h3>{provider.name}</h3>
                    <p>{provider.role}</p>
                  </div>
                  <div className="profile-rating">★ {provider.rating}</div>
                </div>
                <p className="profile-location">⌖ {provider.location}</p>
                <div className="badge-row">
                  {provider.badges.slice(0, 2).map((badge) => (
                    <span key={badge}>✓ {badge}</span>
                  ))}
                </div>
                <div className="profile-footer">
                  <div>
                    <strong>${provider.price}</strong>
                    <span> BSD / hour</span>
                  </div>
                  <Link
                    href="/find-care"
                  >
                    Find available providers
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="how-layout">
          <div className="how-photo">
            <Image
              alt="A Nanas buyer comparing care options on a phone"
              fill
              sizes="(max-width: 980px) 100vw, 44vw"
              src="/nanas/hero-how-it-works-wide.png"
            />
          </div>
          <div>
            <div className="section-heading">
              <div className="eyebrow">
                <span /> How Nanas works
              </div>
              <h2>Simple enough for every family to use.</h2>
              <p>
                Nanas is designed for non-tech savvy users too: choose a
                category, tell us what is needed, compare providers, then keep
                messages, payments, updates, and booking records in one place.
              </p>
            </div>
            <div className="steps-grid">
              {howSteps.map(({ Icon, title, copy }) => (
                <article className="step-card" key={title}>
                  <span>
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nanas-match-section" id="nanas-match">
        <div className="section-heading heading-row">
          <div>
            <div className="eyebrow">
              <span /> Nanas Match
            </div>
            <h2>
              Not sure where to start?
              <br />
              Let Nanas help.
            </h2>
          </div>
          <p>
            Families can search on their own, post a request, or ask Nanas to
            help match them with a provider when the care need is unclear.
          </p>
        </div>
        <div className="feature-grid">
          {featureHighlights.map((item) => (
            <article className="feature-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="safety-section" id="safety">
        <div className="safety-photo">
          <Image
            alt="A Nanas caregiver helping an older woman move safely at home"
            fill
            priority={false}
            sizes="(max-width: 980px) 100vw, 46vw"
            src="/nanas/hero-safety.png"
          />
        </div>
        <div className="safety-copy">
          <div className="eyebrow light">
            <span /> Trust is a process
          </div>
          <h2>Designed to make care feel clearer.</h2>
          <p>
            Nanas gives buyers practical information before they book and keeps
            providers accountable to the services they are approved to provide.
          </p>
          <ul>
            <li>
              <b>Clear verification labels</b>
              <span>
                See exactly which identity checks and relevant service qualifications are current.
              </span>
            </li>
            <li>
              <b>Two-way visit verification</b>
              <span>
                Buyer and provider confirm a secure session code at the start
                of care.
              </span>
            </li>
            <li>
              <b>Reviews tied to real bookings</b>
              <span>
                Only completed, eligible bookings can create public reviews.
              </span>
            </li>
          </ul>
          <Link href="/safety">
            Learn about Nanas safety <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {suggestionsOpen &&
      matchingSuggestions.length > 0 &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className="nanas-care-search-suggestions"
              id="care-search-suggestion-list"
              role="listbox"
              style={suggestionPosition}
            >
              {matchingSuggestions.map((item) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={service === item.value}
                  key={item.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setService(item.value);
                    setSuggestionsOpen(false);
                  }}
                >
                  <strong>{item.value}</strong>
                  <small>
                    {
                      popularCategories.find(
                        (category) => category.code === item.category,
                      )?.name
                    }
                  </small>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      <section className="seller-cta" id="providers">
        <div className="seller-cta-copy">
          <div className="eyebrow">
            <span /> For care providers
          </div>
          <h2>
            Your help makes a difference.
            <br />
            <em>Let people find it.</em>
          </h2>
          <p>
            Create an individual provider profile, share your approved services
            and availability, and manage care or household bookings in one calm
            place.
          </p>
          <Link className="seller-cta-button" href="/become-a-provider">
            Become a provider <span>→</span>
          </Link>
          <small>
            Built for trusted individual providers across The Bahamas.
          </small>
        </div>
        <div className="seller-stat-grid">
          <article>
            <strong>1</strong>
            <span>individual profile</span>
          </article>
          <article>
            <strong>3</strong>
            <span>clear account roles</span>
          </article>
          <article>
            <strong>100%</strong>
            <span>care and household focused</span>
          </article>
          <article>
            <strong>BSD</strong>
            <span>local pricing</span>
          </article>
        </div>
      </section>

      <section className="testimonial-section">
        <div className="quote-mark">“</div>
        <blockquote>
          Finding someone for my mother felt overwhelming. Nanas made it easier
          to understand who could help, when they were free, and what the visit
          would cost.
        </blockquote>
        <div className="quote-person">
          <span>CB</span>
          <div>
            <b>Carla B.</b>
            <small>Buyer in Nassau</small>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div>
          <div className="eyebrow">
            <span /> Helpful answers
          </div>
          <h2>Questions are part of good care.</h2>
          <p>We make the important details easy to find before you book.</p>
        </div>
        <div className="faq-list">
          <details open>
            <summary>
              Who can become a provider on Nanas?<span>+</span>
            </summary>
            <p>
              Individual providers may apply for the services they can safely
              offer. Some categories require identity, background, credential,
              or eligibility checks before appearing on a public profile.
            </p>
          </details>
          <details>
            <summary>
              Does Nanas employ providers?<span>+</span>
            </summary>
            <p>
              Nanas is a care-booking platform. The exact legal relationship and
              provider agreement will be shown clearly before either party
              commits to a booking.
            </p>
          </details>
          <details>
            <summary>
              How are reviews verified?<span>+</span>
            </summary>
            <p>
              Reviews are available only after an eligible completed booking and
              are tied to that transaction. They use a double-blind publishing
              window to reduce retaliation.
            </p>
          </details>
          <details>
            <summary>
              Is Nanas an emergency service?<span>+</span>
            </summary>
            <p>
              No. Nanas is not an emergency service. Urgent or life-threatening
              situations should be handled through locally approved emergency
              channels.
            </p>
          </details>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-brand">
          <Link className="wordmark" href="/">
            Nanas<span>.</span>
          </Link>
          <p>Trusted care and household help, close to home.</p>
        </div>
        <div>
          <b>For buyers</b>
          <Link href="/find-care">Find a provider</Link>
          <Link href="/post-care-request">Post care request</Link>
          <Link href="/safety">Safety</Link>
        </div>
        <div>
          <b>For providers</b>
          <Link href="/become-a-provider">Become a provider</Link>
          <Link href="/care-requests">Care requests</Link>
          <Link href="/services">Care and household services</Link>
        </div>
        <div>
          <b>Nanas</b>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Trust and safety</Link>
          <Link href="/auth">Account</Link>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Nanas. Built for The Bahamas.</span>
          <span>Privacy · Terms · Accessibility</span>
        </div>
      </footer>
    </main>
  );
}
