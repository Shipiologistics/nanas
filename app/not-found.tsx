import Link from "next/link";
import "./marketplace/public-marketplace.css";

export default function NotFound() {
  return <div className="mp-shell"><main className="mp-container mp-page-title">
    <Link className="mp-wordmark" href="/">Nanas<span>.</span></Link>
    <p className="mp-kicker">Page not found</p>
    <h1>We could not find that page.</h1>
    <p>The link may be incorrect or no longer available.</p>
    <p><Link className="mp-inline-link" href="/services">Browse services →</Link></p>
    <p><Link className="mp-inline-link" href="/care-requests">Browse example requests →</Link></p>
    <p><Link className="mp-inline-link" href="/">Return home →</Link></p>
  </main></div>;
}
