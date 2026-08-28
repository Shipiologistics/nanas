import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { ImageUploadKind } from "./cloudinary-policy";
import { IMAGE_UPLOAD_POLICIES } from "./cloudinary-policy";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
};

let configured = false;

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
    throw new Error("Cloudinary server configuration is incomplete");
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
      signature_algorithm: "sha256",
    });
    configured = true;
  }

  return { cloudName, apiKey, apiSecret, uploadPreset };
}

export function createCloudinaryUploadSignature(kind: ImageUploadKind, userId: string) {
  const config = getCloudinaryConfig();
  const policy = IMAGE_UPLOAD_POLICIES[kind];
  const timestamp = Math.floor(Date.now() / 1000);
  const visibility = policy.deliveryType === "upload" ? "public" : "private";
  const folder = `nanas/${visibility}/users/${userId}/${policy.folder}`;
  const publicId = crypto.randomUUID();
  const parameters = {
    allowed_formats: policy.formats.join(","),
    context: `owner=${userId}|kind=${kind}`,
    folder,
    overwrite: "false",
    public_id: publicId,
    timestamp,
    type: policy.deliveryType,
    unique_filename: "false",
    upload_preset: config.uploadPreset,
  };
  const signature = cloudinary.utils.api_sign_request(parameters, config.apiSecret);

  return {
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    endpoint: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
    maxBytes: policy.maxBytes,
    parameters,
    signature,
  };
}

export function expectedCloudinaryPublicId(kind: ImageUploadKind, userId: string) {
  const policy = IMAGE_UPLOAD_POLICIES[kind];
  const visibility = policy.deliveryType === "upload" ? "public" : "private";
  return `nanas/${visibility}/users/${userId}/${policy.folder}/`;
}

export function verifyCloudinaryResponseSignature(publicId: string, version: number, signature: string) {
  const { apiSecret } = getCloudinaryConfig();
  // Upload authentication uses SHA-256, while Cloudinary upload responses are
  // currently signed with the documented SHA-1 public_id/version payload.
  const expected = createHash("sha1")
    .update(`public_id=${publicId}&version=${version}${apiSecret}`)
    .digest("hex");
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function publicCloudinaryUrl(publicId: string, version: number, format: string) {
  getCloudinaryConfig();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    type: "upload",
    version,
    format,
    transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
  });
}

export async function destroyCloudinaryImage(publicId: string, deliveryType: "upload" | "authenticated") {
  getCloudinaryConfig();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: deliveryType,
    invalidate: deliveryType === "upload",
  });
}

export async function inspectCloudinaryImage(
  publicId: string,
  deliveryType: "upload" | "authenticated",
) {
  getCloudinaryConfig();
  const asset = await cloudinary.api.resource(publicId, {
    resource_type: "image",
    type: deliveryType,
  });
  return {
    bytes: Number(asset.bytes),
    format: String(asset.format ?? "").toLowerCase(),
    height: Number(asset.height) || null,
    version: Number(asset.version),
    width: Number(asset.width) || null,
  };
}

export async function pingCloudinary() {
  getCloudinaryConfig();
  return cloudinary.api.ping();
}
