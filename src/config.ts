/**
 * Public, client-side IDs. Both end up in every visitor's browser anyway,
 * so they live in code (not secrets) and every host builds identically.
 */

/** Microsoft Clarity project id (clarity.microsoft.com → Settings → Overview). Empty = off. */
export const CLARITY_ID: string = (import.meta.env.VITE_CLARITY_ID as string | undefined) || 'yowprnmkxa';

/**
 * ntfy.sh topic for owner push notifications. Subscribe to it in the ntfy app.
 * Anyone who reads the source can see it, so it carries no personal data —
 * only the host, device type and event.
 */
export const NTFY_TOPIC = 'pickdot-a87cb396b17c';

/** Which deployment this is, from the hostname. */
export function hostLabel(host = location.hostname): string {
  if (host.endsWith('github.io')) return 'github';
  if (host.endsWith('.hf.space') || host.endsWith('huggingface.co')) return 'huggingface';
  if (host.endsWith('pages.dev')) return 'cloudflare';
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  return host;
}
