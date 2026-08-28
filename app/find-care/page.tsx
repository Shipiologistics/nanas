import { FindCarePage } from "../marketplace/PublicMarketplacePages";

export default async function PublicFindCarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const value = (key: string) => {
    const item = query[key];
    return Array.isArray(item) ? item[0] : item;
  };
  return (
    <FindCarePage
      filters={{
        service: value("service") ?? "all",
        area: value("area") ?? "all",
        sort: value("sort") ?? "recommended",
      }}
    />
  );
}
