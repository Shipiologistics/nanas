import PublicProviderProfile from "../PublicProviderProfile";

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicProviderProfile slug={slug} />;
}
