import { NextRequest, NextResponse } from "next/server";
import { createCloudinaryUploadSignature } from "../../../../../lib/cloudinary-server";
import { formatFromMime, IMAGE_UPLOAD_POLICIES, isImageUploadKind } from "../../../../../lib/cloudinary-policy";
import { authenticatedApiClient, requireSellerRole } from "../../../../../lib/supabase-api-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedApiClient(request);
    const body = (await request.json()) as { kind?: unknown; mimeType?: unknown; bytes?: unknown };
    if (!isImageUploadKind(body.kind)) return NextResponse.json({ error: "Unsupported image purpose" }, { status: 400 });

    const policy = IMAGE_UPLOAD_POLICIES[body.kind];
    const format = typeof body.mimeType === "string" ? formatFromMime(body.mimeType) : null;
    const bytes = Number(body.bytes);
    if (!format || !policy.formats.includes(format)) return NextResponse.json({ error: "Unsupported image format" }, { status: 415 });
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > policy.maxBytes) {
      return NextResponse.json({ error: `Image must be smaller than ${Math.floor(policy.maxBytes / 1024 / 1024)} MB` }, { status: 413 });
    }
    if (policy.sellerOnly) await requireSellerRole(supabase, user.id);

    return NextResponse.json(createCloudinaryUploadSignature(body.kind, user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload authorization failed";
    const status = message.includes("configuration") ? 503 : message.includes("role") ? 403 : 401;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
