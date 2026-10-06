import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { authenticatedApiClient } from "../../../../lib/supabase-api-auth";
import { privateVerificationImageUrl } from "../../../../lib/cloudinary-server";
import { verificationStorageType } from "../../../../lib/verification-storage.mjs";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const documentSchema = z.object({
  id: z.string().uuid(), seller_id: z.string().uuid(), storage_path: z.string(),
  name: z.string(), status: z.string(), uploaded_at: z.string(),
  issue_date: z.string().date().nullable().optional(), expiry_date: z.string().date().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedApiClient(request);
    const input = z.object({ caseId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "A valid verification case is required" }, { status: 400, headers });
    const { data, error } = await supabase.rpc("verification_evidence", { p_case_id: input.data.caseId });
    if (error) {
      const denied = /evidence_not_found|permission_denied/.test(error.message);
      return NextResponse.json({ error: denied ? "Evidence not found or access denied" : "Evidence service is unavailable" }, { status: denied ? 404 : 503, headers });
    }
    const documents = z.array(documentSchema).parse(data);
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    const results = await Promise.all(documents.map(async (document) => {
      const base = { id: document.id, name: document.name, status: document.status, uploadedAt: document.uploaded_at,
        issueDate: document.issue_date ?? null, expiryDate: document.expiry_date ?? null };
      const prefix = `${document.seller_id}/cloudinary/image/authenticated/`;
      if (document.storage_path.startsWith(prefix)) {
        const [format, ...parts] = document.storage_path.slice(prefix.length).split("/");
        const publicId = parts.join("/");
        const ownedPrefix = `nanas/private/users/${document.seller_id}/verification/`;
        if (!["jpg", "jpeg", "png", "webp"].includes(format) || !publicId.startsWith(ownedPrefix) || !/^[a-zA-Z0-9/_-]+$/.test(publicId) || publicId.slice(ownedPrefix.length).includes("/")) {
          return { ...base, error: "Document storage reference is invalid" };
        }
        return { ...base, mediaType: "image", url: privateVerificationImageUrl(publicId, format, expiresAt) };
      }
      const mediaType = verificationStorageType(document.storage_path, document.seller_id);
      if (!mediaType) return { ...base, error: "Document storage reference is invalid or unsupported" };
      // The user-scoped RPC above has already authorized this exact stored case
      // and recorded non-owner admin access. Never use a privileged client for
      // that authorization, accept a request-supplied path, or widen bucket RLS.
      let storageClient = supabase;
      if (document.seller_id !== user.id) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return { ...base, error: "Admin document preview is unavailable. Please contact the site administrator." };
        storageClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      }
      const signed = await storageClient.storage.from("seller-documents").createSignedUrl(document.storage_path, 120);
      if (signed.error || !signed.data?.signedUrl) return { ...base, error: "Document could not be opened. Refresh access or request a replacement." };
      return { ...base, mediaType, url: signed.data.signedUrl };
    }));
    return NextResponse.json({ documents: results, expiresAt }, { headers });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "Authentication required";
    return NextResponse.json({ error: unauthenticated ? "Authentication required" : "Unable to open verification evidence" }, { status: unauthenticated ? 401 : 503, headers });
  }
}
