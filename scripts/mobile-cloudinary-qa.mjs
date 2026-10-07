import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const makeClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const provider = { id: '05e8eb22-5064-47a0-b226-0fd8dea3e97f', email: 'nanas-qa-20261005-muv21zbq-seller@example.com' };
const buyer = { id: '2458f843-d5c1-4b4d-bcde-bfe695459a9d', email: 'nanas-qa-20261005-muv21zbq-buyer@example.com' };
const password = `Qa-${crypto.randomBytes(18).toString('base64url')}aA1`; const base = process.env.NANAS_QA_APP_URL || 'http://localhost:3000';
const imageBytes = fs.readFileSync(path.resolve('mobile/assets/nanas/hero-seller-mobile.webp'));
const providerClient = makeClient(); const buyerClient = makeClient();
const ok = (result) => { if (result.error) throw result.error; return result.data; };
let checks = 0; const pass = async (name, work) => { await work(); checks += 1; console.log(`PASS ${name}`); };

ok(await admin.auth.admin.updateUserById(provider.id, { password })); ok(await admin.auth.admin.updateUserById(buyer.id, { password }));
const providerSession = ok(await providerClient.auth.signInWithPassword({ email: provider.email, password })).session;
const buyerSession = ok(await buyerClient.auth.signInWithPassword({ email: buyer.email, password })).session;
assert(providerSession && buyerSession);

const post = async (route, token, body) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const json = async (response) => { const value = await response.json(); if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : JSON.stringify(value)); return value; };
async function upload(kind) {
  const signed = await json(await post('/api/uploads/images/sign', providerSession.access_token, { kind, mimeType: 'image/webp', bytes: imageBytes.length }));
  const form = new FormData(); form.set('file', new Blob([imageBytes], { type: 'image/webp' }), `mobile-qa-${kind}.webp`); form.set('api_key', signed.apiKey); form.set('signature', signed.signature); for (const [key, value] of Object.entries(signed.parameters)) form.set(key, String(value));
  const cloudinary = await json(await fetch(signed.endpoint, { method: 'POST', body: form }));
  return json(await post('/api/uploads/images/verify', providerSession.access_token, { kind, publicId: cloudinary.public_id, version: cloudinary.version, signature: cloudinary.signature, format: cloudinary.format, bytes: cloudinary.bytes, width: cloudinary.width, height: cloudinary.height }));
}

await pass('image signing rejects anonymous calls', async () => { const response = await post('/api/uploads/images/sign', '', { kind: 'profile', mimeType: 'image/webp', bytes: imageBytes.length }); assert.equal(response.status, 401); });
await pass('seller-only image signing rejects buyer session', async () => { const response = await post('/api/uploads/images/sign', buyerSession.access_token, { kind: 'profile', mimeType: 'image/webp', bytes: imageBytes.length }); assert.equal(response.status, 403); });
let profile;
await pass('provider profile image signs, uploads and server-verifies through Cloudinary', async () => { profile = await upload('profile'); assert(profile.assetRef.startsWith('cloudinary:image:upload:webp:nanas/public/users/')); assert(profile.secureUrl?.startsWith('https://')); });
await pass('unreferenced profile QA image can be deleted', async () => { const response = await post('/api/uploads/images/delete', providerSession.access_token, { kind: 'profile', publicId: profile.publicId }); assert.equal(response.status, 200); });
let evidence;
await pass('protected verification image signs, uploads and verifies as authenticated Cloudinary media', async () => { evidence = await upload('verification'); assert(evidence.assetRef.startsWith('cloudinary:image:authenticated:webp:nanas/private/users/')); assert.equal(evidence.secureUrl, null); });
await pass('verified Cloudinary evidence submits to provider KYC review', async () => { const result = ok(await providerClient.rpc('submit_verification_document', { p_document_type: 'mobile_qa_evidence', p_storage_path: evidence.databasePath, p_original_name: 'mobile-qa-verification.webp' })); assert(result.document_id); const row = ok(await providerClient.from('seller_documents').select('id,status,storage_path').eq('id', result.document_id).single()); assert.equal(row.status, 'pending'); assert.equal(row.storage_path, evidence.databasePath); });

await providerClient.auth.signOut(); await buyerClient.auth.signOut();
console.log(`${checks} Cloudinary and mobile KYC checks passed.`);
