/**
 * Microsoft Clarity on our own app: heatmaps + session recordings of people
 * using Pickdot. One project covers every host; filter by the `host` tag.
 * It cannot tell us which of a user's images performed better — see PRD.
 */
import { CLARITY_ID, hostLabel } from '../config';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };
declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

export function initClarity() {
  if (!CLARITY_ID || window.clarity || hostLabel() === 'local') return;
  const fn: ClarityFn = (...args: unknown[]) => {
    (fn.q = fn.q || []).push(args);
  };
  window.clarity = fn;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`;
  document.head.appendChild(s);
  tag('host', hostLabel());
}

export function tag(key: 'profile_complete' | 'verdict' | 'logged_outcome' | 'platform' | 'host' | 'returning', value: string) {
  window.clarity?.('set', key, value);
}
