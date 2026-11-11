// Pure (no server-only, no classes) so the test reads it straight; the feedback form is its caller.

/**
 * The client address as the hop in front of us saw it — not as the caller declared it.
 *
 * `x-forwarded-for` is a list, and a caller can start it with anything: the proxy in front of us (CloudFront, on the hosted
 * site) APPENDS the address it actually received the request from. So the FIRST entry (what `clientIpFrom` reads) is the
 * caller's to choose, and the LAST entry is the one our own edge wrote. Preference order:
 *   1. `cloudfront-viewer-address` ("ip:port"), which CloudFront sets itself and overwrites if a caller sends one;
 *   2. the last `x-forwarded-for` entry;
 *   3. `x-real-ip`, then 'unknown'.
 * With no proxy in front (the dev server) there is no list to trust and every caller reads 'unknown', a single bucket —
 * the same as before. If an extra hop ever sits after CloudFront, callers share the edge's address and the per-address
 * limit tightens for everyone: a safe failure, never an open one.
 */
export function trustedClientIp(req: Request): string {
  const viewer = req.headers.get('cloudfront-viewer-address')?.trim();
  if (viewer) {
    // "203.0.113.9:4711", or "[2001:db8::1]:4711" for IPv6.
    const colon = viewer.lastIndexOf(':');
    const ip = viewer.startsWith('[') ? viewer.slice(1, viewer.indexOf(']')) : colon > 0 ? viewer.slice(0, colon) : viewer;
    if (ip) return ip;
  }
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const last = fwd.split(',').map(s => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
