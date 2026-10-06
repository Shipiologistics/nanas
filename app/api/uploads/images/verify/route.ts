import { NextRequest, NextResponse } from "next/server";
import {
  destroyCloudinaryImage,
  inspectCloudinaryImage,
  publicCloudinaryUrl,
  verifyCloudinaryResponseSignature,
} from "../../../../../lib/cloudinary-server";
import { IMAGE_UPLOAD_POLICIES, isImageUploadKind, isOwnedCloudinaryPublicId } from "../../../../../lib/cloudinary-policy";
import { authenticatedApiClient, requireActiveAccount, requireSellerRole } from "../../../../../lib/supabase-api-auth";

export const runtime = "nodejs";

type VerifyBody = {
  kind?: unknown;
  publicId?: unknown;
  version?: unknown;
  signature?: unknown;
  format?: unknown;
  bytes?: unknown;
  width?: unknown;
  height?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedApiClient(request);
    await requireActiveAccount(supabase, user.id);
    const body = (await request.json()) as VerifyBody;
    if (!isImageUploadKind(body.kind)) return NextResponse.json({ error: "Unsupported image purpose" }, { status: 400 });
    const policy = IMAGE_UPLOAD_POLICIES[body.kind];
    if (policy.sellerOnly) await requireSellerRole(supabase, user.id);

    const publicId = typeof body.publicId === "string" ? body.publicId : "";
    const signature = typeof body.signature === "string" ? body.signature : "";
    const version = Number(body.version);
    if (!isOwnedCloudinaryPublicId(body.kind, user.id, publicId)) {
      return NextResponse.json({ error: "Image ownership check failed" }, { status: 403 });
    }
    if (!Number.isSafeInteger(version) || version < 1 || !signature || !verifyCloudinaryResponseSignature(publicId, version, signature)) {
      return NextResponse.json({ error: "Cloudinary response verification failed" }, { status: 400 });
    }
    const asset = await inspectCloudinaryImage(publicId, policy.deliveryType);
    if (
      asset.version !== version ||
      !policy.formats.includes(asset.format) ||
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes < 1 ||
      asset.bytes > policy.maxBytes
    ) {
      await destroyCloudinaryImage(publicId, policy.deliveryType);
      return NextResponse.json({ error: "Uploaded image violates the site policy and was removed" }, { status: 415 });
    }

    const assetRef = `cloudinary:image:${policy.deliveryType}:${asset.format}:${publicId}`;
    const databasePath = body.kind === "verification"
      ? `${user.id}/cloudinary/image/${policy.deliveryType}/${asset.format}/${publicId}`
      : assetRef;
    return NextResponse.json({
      assetRef,
      databasePath,
      publicId,
      deliveryType: policy.deliveryType,
      format: asset.format,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      secureUrl: policy.deliveryType === "upload" ? publicCloudinaryUrl(publicId, version, asset.format) : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload verification failed";
    const status = message.includes("configuration") ? 503 : message.includes("role") || message.includes("account") ? 403 : 401;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
