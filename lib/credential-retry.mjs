const prefix = "nanas-credential-retry-v1:";
const uuid = value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const date = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
export function credentialRetryKey(owner) {
  if (!uuid(owner)) throw new Error("A verified provider account is required.");
  return prefix + owner;
}
export function credentialIssuer(value) {
  const issuer=typeof value === "string" ? value.trim() : "";
  if ([...issuer].length < 2 || [...issuer].length > 160) throw new Error("Enter an issuing body with 2–160 non-blank characters.");
  return issuer;
}
export function encodeCredentialRetry(owner, input) {
  credentialRetryKey(owner);
  if (!input || !uuid(input.p_submission_id) || (input.p_service_id!==null && !uuid(input.p_service_id))
    || typeof input.p_credential_type!=="string" || !/^[a-z][a-z0-9_]{1,79}$/.test(input.p_credential_type)
    || !date(input.p_issue_date) || (input.p_expiry_date!==null && (!date(input.p_expiry_date) || input.p_expiry_date<input.p_issue_date))
    || typeof input.p_storage_path!=="string" || !input.p_storage_path.startsWith(`${owner}/`) || input.p_storage_path.length>500
    || input.p_storage_path.split("/").some(part=>!part || part==="." || part===".." || !/^[a-z0-9_.-]+$/i.test(part))
    || typeof input.p_original_name!=="string" || !input.p_original_name || input.p_original_name.length>180)
    throw new Error("Saved credential retry details are invalid. Check your credential records before uploading again.");
  // Only RPC fields; never serialize a File, token, signed URL, or arbitrary keys.
  const payload=Object.fromEntries(["p_submission_id","p_credential_type","p_service_id","p_issue_date","p_expiry_date","p_storage_path","p_original_name"].map(key=>[key,input[key]]));
  payload.p_issuing_body=credentialIssuer(input.p_issuing_body);
  return JSON.stringify({version:1,owner,payload});
}
export function decodeCredentialRetry(value, owner) {
  try {
    if (typeof value!=="string" || value.length>6000) return null;
    const saved=JSON.parse(value);
    if(saved.version!==1 || saved.owner!==owner)return null;
    return JSON.parse(encodeCredentialRetry(owner,saved.payload)).payload;
  } catch {return null;}
}
export function clearCredentialRetries(storageSource) {
  try {
    const storage=typeof storageSource==="function" ? storageSource() : storageSource;
    for(let index=storage.length-1;index>=0;index--){const key=storage.key(index);if(key?.startsWith(prefix))storage.removeItem(key);}
  } catch {/* Unavailable storage must never block sign-out. */}
}
