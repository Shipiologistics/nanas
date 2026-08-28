import NanasPortal from "../NanasPortal";

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ route?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { route = [] } = await params;
  const query = await searchParams;
  const requestedCategory = Array.isArray(query.category)
    ? query.category[0]
    : query.category;
  const openRequest =
    (Array.isArray(query.newRequest) ? query.newRequest[0] : query.newRequest) ===
    "1";
  const initialDemoMode =
    (Array.isArray(query.demo) ? query.demo[0] : query.demo) === "1";
  return (
    <NanasPortal
      key={route.join("/")}
      initialRoute={route}
      initialRequestCategory={openRequest ? requestedCategory : undefined}
      initialDemoMode={initialDemoMode}
    />
  );
}
