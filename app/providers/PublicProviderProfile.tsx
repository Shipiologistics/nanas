"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DemoState, DemoUser } from "../../lib/demo-data";
import { publicProviders } from "../../lib/public-marketplace";
import { NanasProviderProfile } from "../app/TargetedMarketplaceDetails";
import { MarketplaceFooter, MarketplaceHeader } from "../marketplace/MarketplaceShell";
import "./public-provider.css";
import "./profile-mobile-fix.css";

export default function PublicProviderProfile({ slug }: { slug: string }) {
  const router = useRouter();
  const seededSeller = publicProviders.find((provider) => provider.id === slug);
  const [seller, setSeller] = useState<DemoUser | undefined>(seededSeller);
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    if (slug !== "alicia-m") return;
    try {
      const saved = localStorage.getItem("nanas-demo-state-v3");
      if (!saved) return;
      const state = JSON.parse(saved) as Partial<DemoState>;
      const localSeller = state.users?.find(
        (user) => user.id === "seller-alicia" && user.status === "active",
      );
      if (localSeller)
        queueMicrotask(() => setSeller({ ...localSeller, id: "alicia-m" }));
    } catch {
      // The reviewed public seed remains authoritative if local demo data is invalid.
    }
  }, [slug]);
  if (!seller) return <main className="public-profile-missing"><h1>Seller profile unavailable.</h1><Link href="/find-care">Browse healthcare sellers</Link></main>;

  return <div className="public-profile-shell">
    <MarketplaceHeader />
    <main className="public-profile-content"><NanasProviderProfile seller={seller} relatedSellers={publicProviders.filter((provider) => provider.id !== seller.id)} favorite={favorite} onToggleFavorite={() => setFavorite((saved) => !saved)} onRequestCare={() => router.push("/post-care-request")} backHref="/find-care" backLabel="Healthcare sellers" relatedHrefBase="/providers" /></main>
    <MarketplaceFooter />
  </div>;
}
