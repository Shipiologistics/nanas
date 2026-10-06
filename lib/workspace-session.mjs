// A same-account refresh should recheck roles without discarding an open form.
// Unknown or different identities must never inherit the mounted workspace.
export function preserveWorkspaceDuringRefresh(verifiedUserId, nextUserId) {
  return typeof verifiedUserId === "string" && verifiedUserId.length > 0 && verifiedUserId === nextUserId;
}
export function activeAdministratorAccount(profile) {
  return Boolean(profile && profile.account_status === "active" && profile.deleted_at === null);
}
