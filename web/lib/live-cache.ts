import type { User } from "@supabase/supabase-js";
import type { Competition, DemoState } from "@/lib/demo";

/**
 * Last known account snapshot.
 *
 * Every route mounts its own app shell, so without this the shell starts from
 * an empty wallet on each navigation and the balance is withheld until the
 * network answers. Keeping the previous snapshot lets the shell paint the
 * last known balance immediately and refresh underneath it.
 *
 * Exposed as an external store so the shell can read it with
 * useSyncExternalStore: the server pass and the first hydration render both
 * receive `null`, then the stored snapshot is used. That keeps server and
 * client markup identical.
 *
 * Browser memory only: never persisted, never shared between accounts.
 */
export type LiveSnapshot = {
  userId: string | null;
  user: User | null;
  state: DemoState;
  catalog: Competition[];
  tokens: number;
};

let snapshot: LiveSnapshot | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const readSnapshot = () => snapshot;

/** Server and hydration pass: nothing is cached yet on either side. */
export const getServerSnapshot = () => null;

const unchanged = (current: LiveSnapshot, next: LiveSnapshot) =>
  current.userId === next.userId &&
  current.user === next.user &&
  current.state === next.state &&
  current.catalog === next.catalog &&
  current.tokens === next.tokens;

export function writeSnapshot(next: LiveSnapshot) {
  if (snapshot && unchanged(snapshot, next)) return;
  snapshot = next;
  emit();
}

export function clearSnapshot() {
  if (!snapshot) return;
  snapshot = null;
  emit();
}

/** Project name and photo changes into the cached account without a refetch. */
export function patchSnapshotUser(user: User | null) {
  if (!snapshot || snapshot.userId !== (user?.id ?? null) || snapshot.user === user) return;
  snapshot = { ...snapshot, user };
  emit();
}
