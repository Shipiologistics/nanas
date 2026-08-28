"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  GraduationCap,
  HeartHandshake,
  House,
  PawPrint,
  Search,
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
      "Everyday support, companionship, mobility help, and respectful personal care.",
    mark: "SC",
    tone: "mint",
  },
  {
    slug: "home-nursing",
    name: "Home nursing",
    description:
      "Credentialed nursing support, vital checks, wound care, and recovery plans.",
    mark: "RN",
    tone: "teal",
  },
  {
    slug: "post-hospital-care",
    name: "Post-hospital care",
    description:
      "Confident support at home after discharge, surgery, or a health setback.",
    mark: "PH",
    tone: "sand",
  },
  {
    slug: "respite-care",
    name: "Respite care",
    description:
      "Trusted relief for family caregivers, from a few hours to extended support.",
    mark: "RC",
    tone: "sky",
  },
  {
    slug: "disability-care",
    name: "Disability care",
    description:
      "Person-centred assistance that supports choice, access, and independence.",
    mark: "DC",
    tone: "lilac",
  },
  {
    slug: "physiotherapy",
    name: "Physiotherapy",
    description:
      "At-home mobility, rehabilitation, and movement support from qualified sellers.",
    mark: "PT",
    tone: "coral",
  },
];

const popularCategories = [
  {
    code: "child_care",
    name: "Child care",
    examples: "Babysitter · Nanny",
    icon: Users,
  },
  {
    code: "senior_care",
    name: "Senior care",
    examples: "Companion · Hands-on",
    icon: HeartHandshake,
  },
  {
    code: "adult_care",
    name: "Adult care",
    examples: "Companion · Live-in",
    icon: Accessibility,
  },
  {
    code: "pet_care",
    name: "Pet care",
    examples: "Sitter · Walker",
    icon: PawPrint,
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

const sellers = [
  {
    initials: "AM",
    name: "Alicia M.",
    role: "Registered nurse",
    location: "Nassau, New Providence",
    rating: "4.9",
    reviews: 42,
    bookings: 64,
    price: 38,
    service: "Home nursing",
    availability: "Available tomorrow",
    bio: "Eight years of home nursing experience with a focus on older adults, recovery support, and calm family communication.",
    badges: ["Identity verified", "RN credential", "Highly rated"],
    color: "avatar-deep",
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
    service: "Physiotherapy",
    availability: "Next opening Friday",
    bio: "Home-based rehabilitation and mobility support designed around each patient’s goals and comfort.",
    badges: ["Identity verified", "PT credential", "Highly rated"],
    color: "avatar-warm",
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

  const rankedSellers = useMemo(() => {
    const direct = sellers.filter((seller) => seller.service === service);
    return direct.length
      ? [...direct, ...sellers.filter((seller) => seller.service !== service)]
      : sellers;
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

            <fieldset className="hero-mode-toggle">
              <legend>Choose search mode</legend>
              <button type="button" aria-pressed="true">
                <span aria-hidden="true" /> Find care
              </button>
              <Link href="/post-care-request">
                <span aria-hidden="true" /> Post request
              </Link>
            </fieldset>

            <div className="home-search-overlay">
              <form
            className="care-search"
            aria-label="Find healthcare services"
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
                aria-label="Healthcare service"
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
              <span className="care-search-submit-label">Find care</span>
              <Search aria-hidden="true" />
            </button>
              </form>

              <div
                className="hero-popular-searches"
                aria-label="Popular care searches"
              >
                <span>Popular:</span>
                {popularCategories.slice(0, 4).map((item) => (
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
              Healthcare support for
              <br />
              every chapter.
            </h2>
          </div>
          <p>
            From regular support to recovery at home, Nanas helps families
            compare qualified people—not anonymous businesses or agencies.
          </p>
        </div>
        <div className="service-grid">
          {services.map((item) => (
            <Link
              className="service-card"
              href={`/services/${item.slug}`}
              key={item.name}
            >
              <span className={`service-mark ${item.tone}`}>{item.mark}</span>
              <span className="service-card-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span className="round-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section results-section" id="care-results">
        <div className="results-topline">
          <div>
            <div className="eyebrow">
              <span /> Verified individual sellers
            </div>
            <h2>Care professionals families trust.</h2>
          </div>
          <Link href="/find-care">
            View all sellers <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="profile-grid">
          {rankedSellers.map((seller) => (
            <article className="profile-card" key={seller.name}>
              <div className={`profile-photo ${seller.color}`}>
                <span>{seller.initials}</span>
                <div className="profile-availability">
                  <i /> {seller.availability}
                </div>
              </div>
              <div className="profile-body">
                <div className="profile-line">
                  <div>
                    <h3>{seller.name}</h3>
                    <p>{seller.role}</p>
                  </div>
                  <div className="profile-rating">★ {seller.rating}</div>
                </div>
                <p className="profile-location">⌖ {seller.location}</p>
                <div className="badge-row">
                  {seller.badges.slice(0, 2).map((badge) => (
                    <span key={badge}>✓ {badge}</span>
                  ))}
                </div>
                <div className="profile-footer">
                  <div>
                    <strong>${seller.price}</strong>
                    <span> BSD / hour</span>
                  </div>
                  <Link
                    href={`/providers/${seller.name.startsWith("Alicia") ? "alicia-m" : seller.name.startsWith("Marcus") ? "marcus-d" : "simone-r"}`}
                  >
                    View full profile
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-heading centered-heading">
          <div className="eyebrow">
            <span /> Simple from the start
          </div>
          <h2>Find the right care in three steps.</h2>
          <p>
            Clear choices, verified information, and a booking record you can
            return to whenever you need it.
          </p>
        </div>
        <div className="steps-grid">
          {[
            [
              "01",
              "Tell us what you need",
              "Choose a healthcare service, your area, timing, and the needs that matter for the care recipient.",
            ],
            [
              "02",
              "Compare verified sellers",
              "Review credentials, experience, rates, availability, badges, and reviews from completed bookings.",
            ],
            [
              "03",
              "Book with confidence",
              "Confirm the visit, pay through Nanas, message securely, and keep every update in one place.",
            ],
          ].map(([number, title, copy]) => (
            <article className="step-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
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
            sellers accountable to the services they are approved to provide.
          </p>
          <ul>
            <li>
              <b>Clear verification labels</b>
              <span>
                See exactly which checks and healthcare credentials are current.
              </span>
            </li>
            <li>
              <b>Two-way visit verification</b>
              <span>
                Buyer and seller confirm a secure session code at the start of
                care.
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

      <section className="seller-cta" id="sellers">
        <div className="seller-cta-copy">
          <div className="eyebrow">
            <span /> For healthcare sellers
          </div>
          <h2>
            Your care makes a difference.
            <br />
            <em>Let people find it.</em>
          </h2>
          <p>
            Create an individual profile, share your approved healthcare
            services and availability, and manage care bookings in one calm
            place.
          </p>
          <Link className="seller-cta-button" href="/become-a-seller">
            Become a Nanas seller <span>→</span>
          </Link>
          <small>
            No agencies, business accounts, job bidding, or shift rosters.
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
            <span>healthcare-focused</span>
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
          to understand who was qualified, when they were free, and what the
          visit would cost.
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
              Who can sell healthcare services on Nanas?<span>+</span>
            </summary>
            <p>
              Only individual sellers may apply. Each healthcare service has its
              own identity, credential, background, and eligibility requirements
              before it can appear on a public profile.
            </p>
          </details>
          <details>
            <summary>
              Does Nanas employ the sellers?<span>+</span>
            </summary>
            <p>
              Nanas is a care-booking platform. The exact legal relationship and
              seller agreement will be shown clearly before either party commits
              to a booking.
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

      <footer>
        <div className="footer-brand">
          <Link className="wordmark" href="/">
            Nanas<span>.</span>
          </Link>
          <p>Trusted healthcare, close to home.</p>
        </div>
        <div>
          <b>For buyers</b>
          <Link href="/find-care">Find care</Link>
          <Link href="/post-care-request">Post care request</Link>
          <Link href="/safety">Safety</Link>
        </div>
        <div>
          <b>For sellers</b>
          <Link href="/become-a-seller">Join as a seller</Link>
          <Link href="/care-requests">Care requests</Link>
          <Link href="/services">Healthcare services</Link>
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
