"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ReactNode, useState } from "react";
import "./public-marketplace.css";

const links = [
  { href: "/services", label: "Services" },
  { href: "/find-care", label: "Find care" },
  { href: "/care-requests", label: "Care requests" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/become-a-seller", label: "Become a seller" },
];

export function MarketplaceHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  return (
    <header className="mp-header">
      <Link className="mp-wordmark" href="/" onClick={closeMenu}>
        Nanas<span>.</span>
      </Link>
      <nav id="public-navigation" className={open ? "open" : ""}>
        {links.map((item) => (
          <Link
            className={
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? "active"
                : ""
            }
            href={item.href}
            key={item.href}
            onClick={closeMenu}
          >
            {item.label}
          </Link>
        ))}
        <Link className="mp-mobile-login" href="/auth" onClick={closeMenu}>
          Log in
        </Link>
        <Link
          className="mp-mobile-post"
          href="/post-care-request"
          onClick={closeMenu}
        >
          Post a care request
        </Link>
      </nav>
      <div className="mp-actions">
        <Link href="/auth">Log in</Link>
        <Link className="mp-post" href="/post-care-request">
          Post care request
        </Link>
        <button
          type="button"
          aria-controls="public-navigation"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

export function MarketplaceFooter() {
  return <footer className="mp-footer"><div><Link className="mp-wordmark" href="/">Nanas<span>.</span></Link><p>Trusted healthcare at home across The Bahamas.</p><small>Nanas is not an emergency service.</small></div><div><b>Find care</b><Link href="/services">Healthcare services</Link><Link href="/find-care">Healthcare sellers</Link><Link href="/post-care-request">Post care request</Link></div><div><b>Provide care</b><Link href="/care-requests">Browse care requests</Link><Link href="/become-a-seller">Become a seller</Link><Link href="/auth">Seller login</Link></div><div><b>Nanas</b><Link href="/how-it-works">How it works</Link><Link href="/safety">Safety</Link><Link href="/auth">Account</Link></div><div className="mp-footer-bottom">© 2026 Nanas · The Bahamas · BSD pricing</div></footer>;
}

export function MarketplacePage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mp-shell ${className}`}><MarketplaceHeader />{children}<MarketplaceFooter /></div>;
}
