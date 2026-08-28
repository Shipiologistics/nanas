import { CareRequestDetailPage } from "../../marketplace/PublicMarketplacePages";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <CareRequestDetailPage slug={(await params).slug} />; }
