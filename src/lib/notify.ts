/**
 * Owner pings via ntfy.sh: one push per new session, per comparison, per
 * logged outcome. Fire-and-forget; a failure never touches the product.
 * Silent on localhost so development doesn't spam the phone.
 */
import { hostLabel, NTFY_TOPIC } from '../config';

type Event = 'visit' | 'test' | 'outcome';

const TAGS: Record<Event, string> = { visit: 'eyes', test: 'dart', outcome: 'tada' };

function device(): string {
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'phone' : 'desktop';
}

export function ping(event: Event, title: string, detail = '') {
  const host = hostLabel();
  if (!NTFY_TOPIC || host === 'local') return;
  const body = [detail, `${host} · ${device()} · ${navigator.language}`].filter(Boolean).join('\n');
  try {
    void fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      body,
      // Header values must be ASCII.
      headers: { Title: `Pickdot: ${title}`, Tags: TAGS[event] },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never block the app */
  }
}

/** One "visit" ping per browser session. Returning visitors are the PRD's strongest signal. */
export function pingVisit(returning: boolean) {
  try {
    if (sessionStorage.getItem('pickdot.pinged')) return;
    sessionStorage.setItem('pickdot.pinged', '1');
  } catch {
    /* storage blocked: still ping once per load */
  }
  ping('visit', returning ? 'returning visitor' : 'new visitor');
}
