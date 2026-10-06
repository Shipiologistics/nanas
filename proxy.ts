import { NextResponse, type NextRequest } from "next/server";
import { careServices, publicCareRequests } from "./lib/public-marketplace";

// Reject unknown finite catalogue slugs before rendering. In the installed
// Next release, throwing notFound inside these dynamic pages produces an empty
// recovery shell; the static not-found route includes usable server-side links.
// This does not cover or authorize private panels, APIs or live provider IDs.
export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return NextResponse.next();
  let slug: string;
  try { slug = decodeURIComponent(parts[1]); } catch { slug = ""; }
  const catalog = parts[0] === "services" ? careServices : parts[0] === "care-requests" ? publicCareRequests : null;
  if (catalog && !catalog.some(item => item.slug === slug)) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/services/:slug", "/care-requests/:slug"] };
