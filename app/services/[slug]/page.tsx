import { ServiceDetailPage } from "../../marketplace/PublicMarketplacePages";
import { publicDemoEnabled, readPublicProviders } from "../../../lib/public-provider-server";
import { notFound } from "next/navigation";
import { careServices } from "../../../lib/public-marketplace";
export default async function Page({ params,searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { slug } = await params;
  if (!careServices.some(service => service.slug === slug)) notFound();
  const demo = publicDemoEnabled((await searchParams).demo);
  return <ServiceDetailPage slug={slug} directory={await readPublicProviders(demo)} demo={demo} />;
}
