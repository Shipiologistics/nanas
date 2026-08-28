import { NextRequest, NextResponse } from "next/server";
import { destroyCloudinaryImage, expectedCloudinaryPublicId } from "../../../../../lib/cloudinary-server";
import { IMAGE_UPLOAD_POLICIES, isImageUploadKind } from "../../../../../lib/cloudinary-policy";
import { authenticatedApiClient, requireSellerRole } from "../../../../../lib/supabase-api-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedApiClient(request);
    const body = (await request.json()) as { kind?: unknown; publicId?: unknown };
    if (!isImageUploadKind(body.kind) || typeof body.publicId !== "string") {
      return NextResponse.json({ error: "Invalid image deletion request" }, { status: 400 });
    }
    const policy = IMAGE_UPLOAD_POLICIES[body.kind];
    if (policy.sellerOnly) await requireSellerRole(supabase, user.id);
    if (!body.publicId.startsWith(expectedCloudinaryPublicId(body.kind, user.id))) {
      return NextResponse.json({ error: "Image ownership check failed" }, { status: 403 });
    }
    await destroyCloudinaryImage(body.publicId, policy.deliveryType);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image deletion failed";
    const status = message.includes("configuration") ? 503 : message.includes("role") ? 403 : 401;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
