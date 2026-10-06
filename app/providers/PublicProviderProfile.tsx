"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DemoUser } from "../../lib/demo-data";
import { providerMatchesService } from "../../lib/provider-directory.mjs";
import { careServices } from "../../lib/public-marketplace";
import { NanasProviderProfile } from "../app/TargetedMarketplaceDetails";
import { MarketplaceFooter, MarketplaceHeader } from "../marketplace/MarketplaceShell";
import "./public-provider.css";
import "./profile-mobile-fix.css";

export default function PublicProviderProfile({ seller, relatedSellers, demo = false }: { seller: DemoUser; relatedSellers: DemoUser[]; demo?: boolean }) {
  const router = useRouter();
  const requestCare = (serviceId?: string) => {
    const service = seller.sellerDetails?.services.find(item => item.id === serviceId);
    const family = service && careServices.find(item => providerMatchesService({...seller,sellerDetails:{...seller.sellerDetails,services:[service]}},item.slug));
    const query = new URLSearchParams();
    if (family) query.set("service",family.slug);
    if (serviceId) query.set("serviceId",serviceId);
    router.push(`/post-care-request${query.size ? `?${query}` : ""}`);
  };
  if (!seller) return <main className="public-profile-missing"><h1>Provider profile unavailable.</h1><Link href="/find-care">Browse providers</Link></main>;

  return <div className="public-profile-shell">
    <MarketplaceHeader />
    {demo && <p className="marketplace-preview-notice">Sample profile for preview. Qualifications, reviews and availability shown here are illustrative, not a live provider record.</p>}
    <main className="public-profile-content"><NanasProviderProfile seller={seller} relatedSellers={relatedSellers} favorite={false} onToggleFavorite={() => router.push(demo ? "/app/buyer/find-care?demo=1" : `/app/buyer/providers/${seller.id}`)} onRequestCare={requestCare} backHref={demo ? "/find-care?demo=1" : "/find-care"} backLabel="Providers" relatedHrefBase="/providers" querySuffix={demo ? "?demo=1" : ""} /></main>
    <MarketplaceFooter />
  </div>;
}
