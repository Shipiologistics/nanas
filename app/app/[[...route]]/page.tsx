import NanasPortal from "../NanasPortal";
import PortalAccess from "../PortalAccess";
import { notFound, redirect } from "next/navigation";

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ route?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { route = [] } = await params;
  const query = await searchParams;
  const role = route[0] ?? "buyer";
  if (!["buyer", "seller", "admin"].includes(role)) notFound();
  const sections: Record<string, string[]> = {
    buyer: ["overview", "find-care", "providers", "care-requests", "quotes", "bookings", "messages", "wallet", "reviews", "favorites", "household", "notifications", "safety", "account"],
    seller: ["overview", "requests", "quotes", "bookings", "messages", "availability", "services", "earnings", "profile", "kyc", "badges", "safety", "account", "notifications"],
    admin: ["overview", "users", "kyc", "bookings", "disputes", "messages", "moderation", "finance", "notifications", "catalog", "areas", "cases", "analytics", "access", "workers", "audit", "settings"],
  };
  if (!sections[role].includes(route[1] ?? "overview") || route.length > 3) notFound();
  // `/providers/:id` is the provider detail surface. The bare route is a
  // useful, previously-linked alias for the buyer directory, not a missing
  // provider record.
  if (role === "buyer" && route[1] === "providers" && !route[2]) {
    const demo = (Array.isArray(query.demo) ? query.demo[0] : query.demo) === "1";
    redirect(`/app/buyer/find-care${demo ? "?demo=1" : ""}`);
  }
  const requestedCategory = Array.isArray(query.category)
    ? query.category[0]
    : query.category;
  const openRequest =
    (Array.isArray(query.newRequest) ? query.newRequest[0] : query.newRequest) ===
    "1";
  const initialDemoMode =
    (Array.isArray(query.demo) ? query.demo[0] : query.demo) === "1" &&
    (process.env.NODE_ENV === "development" || process.env.ENABLE_DEMO_MODE === "true");
  const portal = (
    <NanasPortal
      key={route.join("/")}
      initialRoute={route}
      initialRequestCategory={openRequest ? requestedCategory : undefined}
      initialDemoMode={initialDemoMode}
      allowConnectedSimulation={process.env.NODE_ENV === "development"}
    />
  );
  return initialDemoMode ? portal : <PortalAccess key={role} role={role}>{portal}</PortalAccess>;
}
