/**
 * lib/safe-redirect.ts
 *
 * Validate a caller-supplied `next` / redirect path so it can only ever point at OUR OWN
 * origin, closing open-redirect/phishing (CWE-601). Isomorphic (server + client).
 *
 * Do NOT hand-roll a startsWith('/') allowlist: the WHATWG URL parser strips ASCII TAB/CR/LF
 * from anywhere in the input BEFORE parsing, so a value like "/<TAB>//evil.com" sails past a
 * prefix check and then resolves to a protocol-relative EXTERNAL origin. Backslashes are
 * likewise normalized to "/" for special schemes. The robust check is to resolve the value
 * with the SAME URL semantics the browser/router uses and require the origin unchanged — the
 * parser strips the control chars for us, so the smuggled "//evil.com" flips the origin and is
 * rejected, and the returned path is guaranteed free of those stripped characters.
 */

/**
 * Returns `next` iff it is a safe SAME-ORIGIN relative path; otherwise `fallback`.
 * Result always begins with "/" (or equals the caller's fallback).
 */
export function safeNextPath(next: unknown, fallback?: string): string;
export function safeNextPath(next: unknown, fallback: null): string | null;
export function safeNextPath(next: unknown, fallback: string | null = '/home'): string | null {
  if (typeof next !== 'string' || next.length === 0) return fallback;
  try {
    const base = 'https://flhq.internal';
    const url = new URL(next, base);
    // Absolute ("https://evil"), protocol-relative ("//evil"), tab-smuggled ("/<TAB>//evil"),
    // or backslash-smuggled ("/\evil" -> "//evil") inputs all change the origin -> reject.
    if (url.origin !== base) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith('/') ? path : fallback;
  } catch {
    return fallback;
  }
}
