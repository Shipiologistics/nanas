import { CareRequestsPage } from "../marketplace/PublicMarketplacePages";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "all";
  return <CareRequestsPage filters={{ service: value("service"), area: value("area"), when: value("when") }} />;
}
