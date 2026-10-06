import { PostCareRequestPage } from "../marketplace/PublicMarketplacePages";
export default async function Page({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams;
  return <PostCareRequestPage initialService={typeof params.service === "string" ? params.service : ""} initialServiceId={typeof params.serviceId === "string" ? params.serviceId : ""} />;
}
