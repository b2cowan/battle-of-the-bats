import type { Metadata, Viewport } from 'next';
import { Inter, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import SiteChrome from '@/components/SiteChrome';
import Footer from '@/components/Footer';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import { OrgNavProvider } from '@/components/OrgNavContext';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import ViewportKeyboardVars from '@/components/ViewportKeyboardVars';
import LegacyInstallBanner from '@/components/LegacyInstallBanner';
import { NO_FLASH_SCRIPT } from '@/lib/no-flash-script';

const inter = Inter({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans'
});

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-display'
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'FieldLogicHQ',
    template: '%s | FieldLogicHQ',
  },
  description: 'The all-in-one platform for Canadian sports organizations — tournaments, house leagues, rep teams, and accounting in one place.',
  // manifest and apple-mobile-web-app-* are intentionally NOT set here.
  // They are added only in the layouts/pages that mount InstallAppPrompt
  // (admin, scorekeeper, coaches, /home, auth) so that the browser's native
  // install prompt does NOT fire on the public marketing pages.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Without this, Chrome/Android leaves the layout viewport (and any 100dvh /
  // position:fixed inset) unchanged when the on-screen keyboard opens — it only
  // pans the visual viewport, sliding fixed content off-screen with no way to
  // scroll back to it. This asks the browser to shrink the layout viewport
  // instead, the same way it already does for its own toolbar.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${barlow.variable} ${ibmPlexMono.variable}`} data-scroll-behavior="smooth">
      <head>
        {/* PWA theme colour — also controls browser address bar tint on Android */}
        <meta name="theme-color" content="#0a0a0f" />
        {/* Favicons — SVG primary (modern browsers), ICO fallback (legacy) */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Apple touch icon for "Add to Home Screen" */}
        <link rel="apple-touch-icon" href="/icons/pwa-192.png" />
        {/* No-flash attributes (density + user theme) — set on <html> before first paint.
            Lives in the ROOT layout only (never re-created on client nav) so React only ever
            hydrates it; a nested layout would make React re-create it client-side, which it
            can't execute (dev warning + FOUC). Consolidated in lib/no-flash-script.ts. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/* Capture the PWA install event as early as possible — before React
            hydrates InstallAppPrompt. Chromium fires `beforeinstallprompt` on
            load, often before the component's effect attaches; missing it means
            the manual "Get the app" trigger can't offer one-tap install (and
            Chrome shows its own native banner because we never suppressed it).
            Stash the event + notify the component. No manifest is set on
            marketing pages, so this only fires where the prompt is mounted. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__flhqInstallEvent=e;window.dispatchEvent(new Event('flhq:install-available'));});window.addEventListener('appinstalled',function(){window.__flhqInstallEvent=null;});})();",
          }}
        />
      </head>
      <body>
        <OrgNavProvider>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <SiteChrome />
          <main id="main-content">{children}</main>
          <Footer />
          {/* Persistent global bar on public tournament routes (Unified Home IA · Phase 5+3).
              Self-gating (like the other root-mounted chrome): renders the Home·Scores·Chat·
              Account bar (neutral, venue-following, client-resolved identity) ONLY on
              /{orgSlug}/{tournamentSlug}/* — the bottom bar ≤900px, a slim top strip >900px. */}
          <ConsumerNav variant="tournament" />
        </OrgNavProvider>
        {/* Install prompts are mounted per-context, not globally: the fan prompt on
            tournament pages and the member prompt in authenticated shells. The
            marketing root no longer shows an install banner. */}
        {/* Soft "get the new app" nudge — self-gates to legacy per-tournament/
            scorekeeper PWA installs (unified-app Phase 0); renders nothing otherwise. */}
        <LegacyInstallBanner />
        {/* Service worker registration — browser-only, renders nothing */}
        <ServiceWorkerRegistration />
        {/* Keeps --vvh / --vv-offset-top in sync with the real visual viewport — browser-only, renders nothing */}
        <ViewportKeyboardVars />
      </body>
    </html>
  );
}
