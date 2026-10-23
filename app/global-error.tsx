'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/client';
import { BRAND_INK, BRAND_NAME, BRAND_NAME_HQ, BRAND_OLIVE, BRAND_PAPER, MARK_BARE_VIEWBOX, MARK_PATH_MAIN } from '@/lib/brand-mark';

// Root error boundary — catches errors thrown in the root layout itself (where app/error.tsx can't reach). It REPLACES
// the root layout, so it must render its own <html>/<body>, and nothing the layout provides exists here: no stylesheet,
// no loaded fonts, no theme, no name component. It draws the family look (The public face, warm: S5) with what survives:
// inline styles, the system font stack, fixed colours, the mark from the shared path, and plain links. Paper for everyone
// (a theme script would race the document being rebuilt), the headline in the system bold rather than the heading face.
const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const EDGE = '#615A54'; // the paper ground's secondary ink (--home-dim): clears 3:1 as a button edge
const LIME = '#D9F99D';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  const button = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '48px',
    padding: '0 22px',
    borderRadius: '10px',
    border: '1px solid transparent',
    font: `700 16px/1 ${SYSTEM_FONT}`,
    textDecoration: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  } as const;

  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <head>
        {/* The root layout's viewport tag is gone with the layout; without one a phone draws this page desktop-scaled. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: BRAND_PAPER,
          color: BRAND_INK,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SYSTEM_FONT,
          padding: '2rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', padding: '28px 8px' }}>
          <div
            aria-hidden="true"
            style={{ width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(87, 101, 30, 0.10)', border: '1px solid rgba(87, 101, 30, 0.35)' }}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={BRAND_OLIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ margin: 0, font: `700 26px/1.2 ${SYSTEM_FONT}` }}>Something went wrong on our side</h1>
          <p style={{ margin: 0, maxWidth: '34ch', fontSize: '16px', lineHeight: 1.5, color: '#4A4235' }}>
            The page couldn’t load. We’ve logged it automatically. Try again, or go to Home.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', width: '100%', marginTop: '6px' }}>
            <button type="button" onClick={() => retry()} style={{ ...button, background: LIME, color: BRAND_INK }}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain anchor: the router and everything the layout set up is gone */}
            <a href="/discover" style={{ ...button, background: '#FFFFFF', color: BRAND_INK, borderColor: EDGE }}>
              Go to Home
            </a>
          </div>
          {/* The name, drawn from lib/brand-mark.ts (tests/unit/public-face-s4-identity.test.ts holds it). */}
          <span
            role="img"
            aria-label="FieldLogicHQ"
            style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '0.45em', fontSize: '15px', lineHeight: 1, whiteSpace: 'nowrap', color: BRAND_INK }}
          >
            <svg viewBox={MARK_BARE_VIEWBOX} aria-hidden="true" style={{ width: '1.1em', height: '1.1em', fill: BRAND_OLIVE }}>
              <path d={MARK_PATH_MAIN} />
            </svg>
            <span style={{ fontWeight: 700, letterSpacing: '-0.018em' }}>
              {BRAND_NAME}
              <span style={{ fontWeight: 600, color: BRAND_OLIVE, letterSpacing: '-0.01em' }}>{BRAND_NAME_HQ}</span>
            </span>
          </span>
        </div>
      </body>
    </html>
  );
}
