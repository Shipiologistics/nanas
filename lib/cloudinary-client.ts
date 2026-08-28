"use client";

import type { ImageUploadKind } from "./cloudinary-policy";
import { getSupabase } from "./supabase";

type SignedUpload = {
  apiKey: string;
  cloudName: string;
  endpoint: string;
  maxBytes: number;
  parameters: Record<string, string | number>;
  signature: string;
};

export type UploadedImage = {
  assetRef: string;
  databasePath: string;
  publicId: string;
  deliveryType: "upload" | "authenticated";
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  secureUrl: string | null;
};

async function authenticatedFetch(input: string, init: RequestInit) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Sign in to upload images");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw error ?? new Error("Sign in to upload images");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } | string };
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    throw new Error(message ?? "Image upload failed");
  }
  return body;
}

export async function uploadImage(file: File, kind: ImageUploadKind): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  const signedResponse = await authenticatedFetch("/api/uploads/images/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, mimeType: file.type, bytes: file.size }),
  });
  const signed = await jsonOrError<SignedUpload>(signedResponse);

  const form = new FormData();
  form.set("file", file);
  form.set("api_key", signed.apiKey);
  form.set("signature", signed.signature);
  for (const [key, value] of Object.entries(signed.parameters)) form.set(key, String(value));

  const cloudinaryResponse = await fetch(signed.endpoint, { method: "POST", body: form });
  const cloudinaryResult = await jsonOrError<{
    public_id: string;
    version: number;
    signature: string;
    format: string;
    bytes: number;
    width?: number;
    height?: number;
  }>(cloudinaryResponse);

  const verifiedResponse = await authenticatedFetch("/api/uploads/images/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      publicId: cloudinaryResult.public_id,
      version: cloudinaryResult.version,
      signature: cloudinaryResult.signature,
      format: cloudinaryResult.format,
      bytes: cloudinaryResult.bytes,
      width: cloudinaryResult.width,
      height: cloudinaryResult.height,
    }),
  });
  return jsonOrError<UploadedImage>(verifiedResponse);
}

export async function deleteImage(publicId: string, kind: ImageUploadKind) {
  const response = await authenticatedFetch("/api/uploads/images/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, publicId }),
  });
  await jsonOrError<{ ok: true }>(response);
}

export function parseCloudinaryAssetRef(assetRef?: string | null) {
  const match = assetRef?.match(/^cloudinary:image:(upload|authenticated):(jpg|jpeg|png|webp|gif):(.+)$/);
  return match ? { deliveryType: match[1] as "upload" | "authenticated", format: match[2], publicId: match[3] } : null;
}

export function cloudinaryPublicImageUrl(assetRef?: string | null) {
  const parsed = parseCloudinaryAssetRef(assetRef);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!parsed || parsed.deliveryType !== "upload" || !cloudName) return undefined;
  const publicId = parsed.publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/f_auto,q_auto,c_limit,w_1600,h_1600/${publicId}`;
}
