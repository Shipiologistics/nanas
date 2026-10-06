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
