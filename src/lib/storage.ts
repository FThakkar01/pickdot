/**
 * v0 persistence: localStorage only, keyed by a browser-generated id.
 * Clearing the browser loses the profile — an accepted v0 failure (see PRD).
 * Every access is guarded: storage can throw in private windows.
 */
import type { ComparisonRecord, Outcome, Profile } from './types';

const K = {
  id: 'pickdot.browserId',
  profile: 'pickdot.profile',
  comparisons: 'pickdot.comparisons',
};

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the session still works */
  }
}

export const hasBrowserId = () => read<string>(K.id) !== null;

export function browserId(): string {
  let id = read<string>(K.id);
  if (!id) {
    id = crypto.randomUUID();
    write(K.id, id);
  }
  return id;
}

export const loadProfile = () => read<Profile>(K.profile);
export const saveProfile = (p: Profile) => write(K.profile, p);

export const loadComparisons = () => read<ComparisonRecord[]>(K.comparisons) ?? [];

export function saveComparison(c: ComparisonRecord) {
  const all = loadComparisons().filter((x) => x.id !== c.id);
  write(K.comparisons, [c, ...all].slice(0, 30));
}

export function patchComparison(id: string, patch: Partial<ComparisonRecord>) {
  write(
    K.comparisons,
    loadComparisons().map((c) => (c.id === id ? { ...c, ...patch } : c)),
  );
}

export function logOutcome(id: string, outcome: Outcome) {
  patchComparison(id, { outcome });
}

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

/** The in-app stand-in for the follow-up email: an old comparison with no outcome. */
export function pendingOutcome(now = Date.now()): ComparisonRecord | null {
  return loadComparisons().find((c) => !c.outcome && !c.outcomeDismissed && now - c.createdAt >= TWO_DAYS) ?? null;
}

export function hitRate(): { logged: number; right: number } {
  const scored = loadComparisons().filter(
    (c) => c.outcome && c.outcome.posted !== 'neither' && c.outcome.performance && c.verdict !== 'close',
  );
  const right = scored.filter((c) => {
    const o = c.outcome!;
    const pickedOurs = o.posted === c.verdict;
    return (pickedOurs && o.performance !== 'worse') || (!pickedOurs && o.performance === 'worse');
  }).length;
  return { logged: scored.length, right };
}
