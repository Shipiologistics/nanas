const origin = 'https://nanas.invalid';
const rolePattern = /^\/app\/(buyer|seller|admin)(?:\/[A-Za-z0-9-]+)*\/?$/;

// Only canonical local workspace routes can be post-auth destinations.
// Query strings (including request-draft handoff) and anchors are preserved.
export function safeWorkspacePath(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value) || !value.startsWith('/app/')) return undefined;
  const rawPath = value.split(/[?#]/, 1)[0];
  if (!rolePattern.test(rawPath)) return undefined;
  const url = new URL(value, origin);
  if (url.origin !== origin || url.pathname !== rawPath) return undefined;
  return url.pathname + url.search + url.hash;
}

export function ownWorkspace(roles) {
  const role = ['admin','seller','buyer'].find(value => roles.includes(value));
  return role ? `/app/${role}/overview` : null;
}

export function workspaceRoute(nextPath, roles) {
  const safePath = safeWorkspacePath(nextPath);
  if (!safePath) return { destination: ownWorkspace(roles), requestedRole: null };
  const requestedRole = safePath.split('/')[2].split(/[?#]/)[0];
  return { destination: roles.includes(requestedRole) ? safePath : null, requestedRole };
}
