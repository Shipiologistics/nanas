import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

type UploadKind = 'profile' | 'verification' | 'message' | 'case-evidence';
type SignedUpload = { apiKey: string; endpoint: string; parameters: Record<string, string | number>; signature: string };
export type UploadedImage = { assetRef: string; databasePath: string; publicId: string; secureUrl: string | null };

function apiBase() {
  const value = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!value) throw new Error('Image uploads are unavailable until EXPO_PUBLIC_APP_URL is configured.');
  return value;
}

async function authenticatedFetch(path: string, init: RequestInit) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw error ?? new Error('Sign in to upload images.');
  const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string | { message?: string } };
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || 'Image upload failed.');
  return body;
}

export async function uploadImage(asset: ImagePickerAsset, kind: UploadKind): Promise<UploadedImage> {
  const mimeType = asset.mimeType || 'image/jpeg'; const bytes = Number(asset.fileSize || 0);
  if (!mimeType.startsWith('image/')) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw new Error('The selected image size could not be verified.');
  const signed = await json<SignedUpload>(await authenticatedFetch('/api/uploads/images/sign', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, mimeType, bytes }),
  }));
  const source = await fetch(asset.uri); const blob = await source.blob();
  const form = new FormData(); form.append('file', blob, asset.fileName || `nanas-${kind}.jpg`); form.append('api_key', signed.apiKey); form.append('signature', signed.signature);
  Object.entries(signed.parameters).forEach(([key, value]) => form.append(key, String(value)));
  const uploaded = await json<{ public_id: string; version: number; signature: string; format: string; bytes: number; width?: number; height?: number }>(await fetch(signed.endpoint, { method: 'POST', body: form }));
  return json<UploadedImage>(await authenticatedFetch('/api/uploads/images/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature, format: uploaded.format, bytes: uploaded.bytes, width: uploaded.width, height: uploaded.height }),
  }));
}
