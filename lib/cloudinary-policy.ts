export const IMAGE_UPLOAD_KINDS = [
  "profile",
  "verification",
  "message",
  "booking",
  "care-request",
  "general",
] as const;

export type ImageUploadKind = (typeof IMAGE_UPLOAD_KINDS)[number];

export type ImageUploadPolicy = {
  folder: string;
  deliveryType: "upload" | "authenticated";
  maxBytes: number;
  formats: readonly string[];
  sellerOnly: boolean;
};

const PUBLIC_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
const PRIVATE_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

export const IMAGE_UPLOAD_POLICIES: Record<ImageUploadKind, ImageUploadPolicy> = {
  profile: {
    folder: "profile",
    deliveryType: "upload",
    maxBytes: 5 * 1024 * 1024,
    formats: PRIVATE_IMAGE_FORMATS,
    sellerOnly: true,
  },
  verification: {
    folder: "verification",
    deliveryType: "authenticated",
    maxBytes: 10 * 1024 * 1024,
    formats: PRIVATE_IMAGE_FORMATS,
    sellerOnly: true,
  },
  message: {
    folder: "messages",
    deliveryType: "authenticated",
    maxBytes: 10 * 1024 * 1024,
    formats: PRIVATE_IMAGE_FORMATS,
    sellerOnly: false,
  },
  booking: {
    folder: "bookings",
    deliveryType: "authenticated",
    maxBytes: 10 * 1024 * 1024,
    formats: PRIVATE_IMAGE_FORMATS,
    sellerOnly: false,
  },
  "care-request": {
    folder: "care-requests",
    deliveryType: "authenticated",
    maxBytes: 10 * 1024 * 1024,
    formats: PRIVATE_IMAGE_FORMATS,
    sellerOnly: false,
  },
  general: {
    folder: "general",
    deliveryType: "upload",
    maxBytes: 10 * 1024 * 1024,
    formats: PUBLIC_IMAGE_FORMATS,
    sellerOnly: false,
  },
};

export function isImageUploadKind(value: unknown): value is ImageUploadKind {
  return typeof value === "string" && IMAGE_UPLOAD_KINDS.includes(value as ImageUploadKind);
}

export function formatFromMime(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  return null;
}

export function cloudinaryPublicIdPrefix(kind: ImageUploadKind, userId: string) {
  const policy = IMAGE_UPLOAD_POLICIES[kind];
  const visibility = policy.deliveryType === "upload" ? "public" : "private";
  return `nanas/${visibility}/users/${userId}/${policy.folder}/`;
}

export function isOwnedCloudinaryPublicId(kind: ImageUploadKind, userId: string, publicId: string) {
  const prefix = cloudinaryPublicIdPrefix(kind, userId);
  return publicId.startsWith(prefix)
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId.slice(prefix.length));
}
