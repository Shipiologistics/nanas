import { CareRequestDetailPage } from "../../marketplace/PublicMarketplacePages";
import { notFound } from "next/navigation";
import { publicCareRequests } from "../../../lib/public-marketplace";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!publicCareRequests.some(request => request.slug === slug)) notFound();
  return <CareRequestDetailPage slug={slug} />;
}
