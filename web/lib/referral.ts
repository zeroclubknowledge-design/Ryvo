/**
 * Invite-link attribution. `?ref=<username>` on any page is remembered on this
 * device for 30 days (the first invite wins), and sign-up sends it as
 * `referred_by`. The database links the referral once, when the account is
 * created (trigger ryvo_link_referral), so it can't be changed afterwards.
 */
const KEY = "ryvo-referred-by";
const KEEP_FOR = 30 * 24 * 60 * 60 * 1000;
const VALID = /^[a-z0-9_.]{3,24}$/;

export function rememberReferral(search: string) {
  try {
    const ref = new URLSearchParams(search).get("ref")?.trim().toLowerCase();
    if (!ref || !VALID.test(ref)) return;
    const saved = JSON.parse(localStorage.getItem(KEY) || "null") as { username: string; at: number } | null;
    if (saved && Date.now() - saved.at < KEEP_FOR) return;
    localStorage.setItem(KEY, JSON.stringify({ username: ref, at: Date.now() }));
  } catch { /* storage blocked */ }
}

/** The inviter's username, unless it's the new player's own. */
export function referredBy(ownUsername: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null") as { username: string; at: number } | null;
    if (!saved || Date.now() - saved.at >= KEEP_FOR || !VALID.test(saved.username)) return undefined;
    return saved.username === ownUsername.trim().toLowerCase() ? undefined : saved.username;
  } catch {
    return undefined;
  }
}
