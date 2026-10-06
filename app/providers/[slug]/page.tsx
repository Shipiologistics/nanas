import PublicProviderProfile from "../PublicProviderProfile";
import { notFound } from "next/navigation";
import { publicDemoEnabled, readPublicProviders } from "../../../lib/public-provider-server";
import Link from "next/link";

export default async function ProviderPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { slug } = await params;
  const demo = publicDemoEnabled((await searchParams).demo);
  const directory = await readPublicProviders(demo);
  if (directory.error) return <main className="mp-container mp-section"><h1>Provider profile could not be loaded.</h1><p>The directory is temporarily unavailable. Please try again.</p><Link href={`/providers/${encodeURIComponent(slug)}`}>Retry profile</Link></main>;
  const seller = directory.providers.find(provider => provider.id === slug || provider.publicSlug === slug);
  if (!seller) notFound();
  return <PublicProviderProfile seller={seller} relatedSellers={directory.providers.filter(provider=>provider.id!==seller.id).slice(0,3)} demo={demo} />;
}
