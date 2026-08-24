"use client";

import { FormEvent, useMemo, useState } from "react";

const services = [
  {
    name: "Senior care",
    description: "Everyday support, companionship, mobility help, and respectful personal care.",
    mark: "SC",
    tone: "mint",
  },
  {
    name: "Home nursing",
    description: "Credentialed nursing support, vital checks, wound care, and recovery plans.",
    mark: "RN",
    tone: "teal",
  },
  {
    name: "Post-hospital care",
    description: "Confident support at home after discharge, surgery, or a health setback.",
    mark: "PH",
    tone: "sand",
  },
  {
    name: "Respite care",
    description: "Trusted relief for family caregivers, from a few hours to extended support.",
    mark: "RC",
    tone: "sky",
  },
  {
    name: "Disability care",
    description: "Person-centred assistance that supports choice, access, and independence.",
    mark: "DC",
    tone: "lilac",
  },
  {
    name: "Physiotherapy",
    description: "At-home mobility, rehabilitation, and movement support from qualified sellers.",
    mark: "PT",
    tone: "coral",
  },
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

type Seller = (typeof sellers)[number];

export default function NanasHome() {
  const [service, setService] = useState("Senior care");
  const [location, setLocation] = useState("Nassau, New Providence");
  const [searched, setSearched] = useState(false);
  const [modal, setModal] = useState<"join" | "login" | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

  const rankedSellers = useMemo(() => {
    const direct = sellers.filter((seller) => seller.service === service);
    return direct.length ? [...direct, ...sellers.filter((seller) => seller.service !== service)] : sellers;
  }, [service]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearched(true);
    requestAnimationFrame(() => document.querySelector("#care-results")?.scrollIntoView({ behavior: "smooth" }));
  }

  function chooseService(nextService: string) {
    setService(nextService);
    setSearched(true);
    requestAnimationFrame(() => document.querySelector("#care-results")?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Nanas home">Nanas<span>.</span></a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#care">Find care</a>
          <a href="#how">How it works</a>
          <a href="#safety">Safety</a>
          <a href="#sellers">Become a seller</a>
        </nav>
        <div className="header-actions">
          <button className="link-button" type="button" onClick={() => setModal("login")}>Log in</button>
          <button className="outline-button" type="button" onClick={() => setModal("join")}>Join Nanas</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Healthcare across The Bahamas</div>
          <h1>Trusted care,<br /><em>close to home.</em></h1>
          <p className="hero-description">
            Find verified nurses and care professionals for the people who matter most.
            Clear profiles, real availability, and support at every step.
          </p>

          <form className="care-search" aria-label="Find healthcare services" onSubmit={submitSearch}>
            <label>
              <span>I&apos;m looking for</span>
              <select value={service} onChange={(event) => setService(event.target.value)} aria-label="Healthcare service">
                {services.map((item) => <option key={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Near</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Location" />
            </label>
            <button type="submit">Find care <span aria-hidden="true">→</span></button>
          </form>

          <div className="trust-row" aria-label="Nanas trust features">
            <span>✓ Verified identities</span>
            <span>✓ Healthcare credentials</span>
            <span>✓ Booking protection</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Featured healthcare seller">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="portrait-placeholder">
            <div className="portrait-person" aria-hidden="true">
              <span className="portrait-head" />
              <span className="portrait-body" />
              <span className="portrait-stethoscope">◡</span>
            </div>
            <div className="portrait-copy">
              <small>Care that feels personal</small>
              <strong>Professional support,<br />right where you are.</strong>
            </div>
          </div>
          <article className="seller-card">
            <div className="avatar avatar-deep">AM</div>
            <div>
              <div className="seller-name">Alicia M.</div>
              <div className="seller-role">Registered nurse · Nassau</div>
              <div className="seller-rating"><b>★ 4.9</b> <span>42 verified reviews</span></div>
            </div>
            <div className="verified-badge" aria-label="Identity and credentials verified">✓</div>
          </article>
          <div className="availability-card"><span className="pulse" /> Available this week</div>
        </div>
      </section>

      <section className="service-strip" aria-label="Popular healthcare services">
        <p>Popular care</p>
        {services.slice(0, 4).map((item, index) => (
          <button type="button" onClick={() => chooseService(item.name)} key={item.name}>
            <span>{String(index + 1).padStart(2, "0")}</span>{item.name}
          </button>
        ))}
      </section>

      <section className="section care-section" id="care">
        <div className="section-heading heading-row">
          <div>
            <div className="eyebrow"><span /> Care built around people</div>
            <h2>Healthcare support for<br />every chapter.</h2>
          </div>
          <p>From regular support to recovery at home, Nanas helps families compare qualified people—not anonymous businesses or agencies.</p>
        </div>
        <div className="service-grid">
          {services.map((item) => (
            <button className="service-card" type="button" key={item.name} onClick={() => chooseService(item.name)}>
              <span className={`service-mark ${item.tone}`}>{item.mark}</span>
              <span className="service-card-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span className="round-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section results-section" id="care-results">
        <div className="results-topline">
          <div>
            <div className="eyebrow"><span /> Verified individual sellers</div>
            <h2>{searched ? `${service} near ${location}` : "Care professionals families trust."}</h2>
          </div>
          <a href="#care">View all care <span aria-hidden="true">→</span></a>
        </div>
        <div className="profile-grid">
          {rankedSellers.map((seller) => (
            <article className="profile-card" key={seller.name}>
              <div className={`profile-photo ${seller.color}`}>
                <span>{seller.initials}</span>
                <div className="profile-availability"><i /> {seller.availability}</div>
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
                  {seller.badges.slice(0, 2).map((badge) => <span key={badge}>✓ {badge}</span>)}
                </div>
                <div className="profile-footer">
                  <div><strong>${seller.price}</strong><span> BSD / hour</span></div>
                  <button type="button" onClick={() => setSelectedSeller(seller)}>View profile</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-heading centered-heading">
          <div className="eyebrow"><span /> Simple from the start</div>
          <h2>Find the right care in three steps.</h2>
          <p>Clear choices, verified information, and a booking record you can return to whenever you need it.</p>
        </div>
        <div className="steps-grid">
          {[
            ["01", "Tell us what you need", "Choose a healthcare service, your area, timing, and the needs that matter for the care recipient."],
            ["02", "Compare verified sellers", "Review credentials, experience, rates, availability, badges, and reviews from completed bookings."],
            ["03", "Book with confidence", "Confirm the visit, pay through Nanas, message securely, and keep every update in one place."],
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
        <div className="safety-art" aria-hidden="true">
          <div className="shield-ring"><span>✓</span></div>
          <div className="safety-pill safety-pill-one">Identity checked</div>
          <div className="safety-pill safety-pill-two">Credentials reviewed</div>
          <div className="safety-pill safety-pill-three">Verified reviews</div>
        </div>
        <div className="safety-copy">
          <div className="eyebrow light"><span /> Trust is a process</div>
          <h2>Designed to make care feel clearer.</h2>
          <p>Nanas gives buyers practical information before they book and keeps sellers accountable to the services they are approved to provide.</p>
          <ul>
            <li><b>Clear verification labels</b><span>See exactly which checks and healthcare credentials are current.</span></li>
            <li><b>Two-way visit verification</b><span>Buyer and seller confirm a secure session code at the start of care.</span></li>
            <li><b>Reviews tied to real bookings</b><span>Only completed, eligible bookings can create public reviews.</span></li>
          </ul>
          <a href="#top">Learn about Nanas safety <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className="seller-cta" id="sellers">
        <div className="seller-cta-copy">
          <div className="eyebrow"><span /> For healthcare sellers</div>
          <h2>Your care makes a difference.<br /><em>Let people find it.</em></h2>
          <p>Create an individual profile, share your approved healthcare services and availability, and manage care bookings in one calm place.</p>
          <button type="button" onClick={() => setModal("join")}>Become a Nanas seller <span>→</span></button>
          <small>No agencies, business accounts, job bidding, or shift rosters.</small>
        </div>
        <div className="seller-stat-grid">
          <article><strong>1</strong><span>individual profile</span></article>
          <article><strong>3</strong><span>clear account roles</span></article>
          <article><strong>100%</strong><span>healthcare-focused</span></article>
          <article><strong>BSD</strong><span>local pricing</span></article>
        </div>
      </section>

      <section className="testimonial-section">
        <div className="quote-mark">“</div>
        <blockquote>
          Finding someone for my mother felt overwhelming. Nanas made it easier to understand who was qualified, when they were free, and what the visit would cost.
        </blockquote>
        <div className="quote-person"><span>CB</span><div><b>Carla B.</b><small>Buyer in Nassau</small></div></div>
      </section>

      <section className="faq-section">
        <div>
          <div className="eyebrow"><span /> Helpful answers</div>
          <h2>Questions are part of good care.</h2>
          <p>We make the important details easy to find before you book.</p>
        </div>
        <div className="faq-list">
          <details open><summary>Who can sell healthcare services on Nanas?<span>+</span></summary><p>Only individual sellers may apply. Each healthcare service has its own identity, credential, background, and eligibility requirements before it can appear on a public profile.</p></details>
          <details><summary>Does Nanas employ the sellers?<span>+</span></summary><p>Nanas is a care-booking platform. The exact legal relationship and seller agreement will be shown clearly before either party commits to a booking.</p></details>
          <details><summary>How are reviews verified?<span>+</span></summary><p>Reviews are available only after an eligible completed booking and are tied to that transaction. They use a double-blind publishing window to reduce retaliation.</p></details>
          <details><summary>Is Nanas an emergency service?<span>+</span></summary><p>No. Nanas is not an emergency service. Urgent or life-threatening situations should be handled through locally approved emergency channels.</p></details>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><a className="wordmark" href="#top">Nanas<span>.</span></a><p>Trusted healthcare, close to home.</p></div>
        <div><b>For buyers</b><a href="#care">Find care</a><a href="#how">How it works</a><a href="#safety">Safety</a></div>
        <div><b>For sellers</b><a href="#sellers">Join as a seller</a><a href="#care">Healthcare services</a><a href="#top">Seller standards</a></div>
        <div><b>Nanas</b><a href="#top">About</a><a href="#top">Help centre</a><a href="#top">Contact</a></div>
        <div className="footer-bottom"><span>© 2026 Nanas. Built for The Bahamas.</span><span>Privacy · Terms · Accessibility</span></div>
      </footer>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setModal(null)}>×</button>
            <div className="modal-mark">N.</div>
            <h2 id="account-title">{modal === "login" ? "Welcome back." : "How will you use Nanas?"}</h2>
            <p>{modal === "login" ? "Account access will connect to secure Nanas authentication." : "Choose your starting role. One account can use buyer and seller capabilities."}</p>
            {modal === "login" ? (
              <form className="login-form" onSubmit={(event) => event.preventDefault()}>
                <label>Email or phone<input placeholder="you@example.com" /></label>
                <button type="submit">Continue securely</button>
                <small>Authentication connection is the next implementation step.</small>
              </form>
            ) : (
              <div className="role-options">
                <button type="button"><span>Buyer</span><small>I need healthcare or care support</small><b>→</b></button>
                <button type="button"><span>Seller</span><small>I personally provide healthcare services</small><b>→</b></button>
              </div>
            )}
          </section>
        </div>
      )}

      {selectedSeller && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedSeller(null)}>
          <section className="modal-card seller-modal" role="dialog" aria-modal="true" aria-labelledby="seller-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setSelectedSeller(null)}>×</button>
            <div className={`modal-avatar ${selectedSeller.color}`}>{selectedSeller.initials}</div>
            <div className="eyebrow"><span /> {selectedSeller.availability}</div>
            <h2 id="seller-title">{selectedSeller.name}</h2>
            <h3>{selectedSeller.role} · {selectedSeller.location}</h3>
            <p>{selectedSeller.bio}</p>
            <div className="modal-badges">{selectedSeller.badges.map((badge) => <span key={badge}>✓ {badge}</span>)}</div>
            <div className="modal-price"><div><b>★ {selectedSeller.rating}</b><span>{selectedSeller.reviews} verified reviews</span></div><div><b>${selectedSeller.price} BSD</b><span>per hour</span></div></div>
            <button className="primary-wide" type="button" onClick={() => { setSelectedSeller(null); setModal("login"); }}>Request care with {selectedSeller.name.split(" ")[0]}</button>
          </section>
        </div>
      )}
    </main>
  );
}
