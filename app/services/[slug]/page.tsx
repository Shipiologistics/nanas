import { ServiceDetailPage } from "../../marketplace/PublicMarketplacePages";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <ServiceDetailPage slug={(await params).slug} />; }
