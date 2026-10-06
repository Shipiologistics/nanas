import { FindCarePage } from "../marketplace/PublicMarketplacePages";
import { publicDemoEnabled, readPublicProviders } from "../../lib/public-provider-server";

export default async function PublicFindCarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const demo = publicDemoEnabled(query.demo);
  const directory = await readPublicProviders(demo);
  const value = (key: string) => {
    const item = query[key];
    return Array.isArray(item) ? item[0] : item;
  };
  const categories: Record<string, string> = {
    senior_care: "senior-care", child_care: "child-care", adult_care: "home-healthcare",
    housekeeping: "housekeeping", tutoring: "tutoring", pet_care: "pet-care",
  };
  const area = value("area")?.trim().toLowerCase() ?? "all";
  const normalizedArea = area.includes("nassau") || area.includes("new providence")
    ? "nassau" : area.includes("freeport") || area.includes("grand bahama")
      ? "freeport" : area.includes("abaco") || area.includes("marsh harbour") ? "abaco" : area || "all";
  return (
    <FindCarePage
      directory={directory} demo={demo} page={Number(value("page") ?? 1)}
      filters={{
        service: value("service") ?? categories[value("category") ?? ""] ?? "all",
        area: normalizedArea,
        sort: value("sort") ?? "recommended",
        search: value("category") ? "" : value("search") ?? "",
      }}
    />
  );
}
