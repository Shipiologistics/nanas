// Apply only to a record returned by the caller-authorized evidence RPC.
// Do not accept object paths or owners directly from a browser request.
export function verificationStorageType(path, owner) {
  if (typeof owner !== "string" || !/^[a-f0-9-]{36}$/i.test(owner) || typeof path !== "string" || !path.startsWith(`${owner}/`)) return null;
  const parts = path.slice(owner.length + 1).split("/");
  if (parts.some(part => !part || part === "." || part === ".." || !/^[a-z0-9_.-]+$/i.test(part))) return null;
  const extension = parts.at(-1).split(".").at(-1).toLowerCase();
  return extension === "pdf" ? "document" : ["jpg","jpeg","png","webp"].includes(extension) ? "image" : null;
}
