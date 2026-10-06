import { NextRequest, NextResponse } from "next/server";
import { destroyCloudinaryImage } from "../../../../../lib/cloudinary-server";
import { IMAGE_UPLOAD_POLICIES, isImageUploadKind, isOwnedCloudinaryPublicId } from "../../../../../lib/cloudinary-policy";
import { authenticatedApiClient, requireSellerRole } from "../../../../../lib/supabase-api-auth";
import { parseCloudinaryAssetRef } from "../../../../../lib/profile-media";

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
    if (!isOwnedCloudinaryPublicId(body.kind, user.id, body.publicId)) {
      return NextResponse.json({ error: "Image ownership check failed" }, { status: 403 });
    }
    if (body.kind === "profile") {
      const profile = await supabase.from("seller_profiles").select("avatar_path").eq("user_id", user.id).maybeSingle();
      if (profile.error) throw new Error("Image reference check failed");
      if (parseCloudinaryAssetRef(profile.data?.avatar_path)?.publicId === body.publicId) {
        return NextResponse.json({ error: "Image is still in use" }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }
    }
    if (body.kind === "verification") {
      const reference = await supabase.from("seller_documents").select("id")
        .eq("seller_id", user.id)
        .like("storage_path", `${user.id}/cloudinary/image/authenticated/%/${body.publicId}`)
        .limit(1);
      if (reference.error) throw new Error("Image reference check failed");
      if (reference.data.length > 0) {
        return NextResponse.json({ error: "Image is still in use" }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }
    }
    await destroyCloudinaryImage(body.publicId, policy.deliveryType);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image deletion failed";
    const status = message.includes("configuration") || message.includes("reference check") ? 503 : message.includes("role") ? 403 : 401;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
