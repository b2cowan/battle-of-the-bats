import type { Metadata } from 'next';
import { Inter, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import SiteChrome from '@/components/SiteChrome';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { OrgNavProvider } from '@/components/OrgNavContext';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

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
        {/* No-flash admin density — set data-density on <html> before first paint.
            Lives in the root layout (never re-created on client nav) so React only
            ever hydrates it; placing it in a layout you navigate *into* makes React
            re-create it on the client, which it can't execute (dev warning + FOUC). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var k='fl_admin_density',v=null;try{v=localStorage.getItem(k);}catch(e){}if(v!=='comfortable'&&v!=='compact'){v=(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)?'comfortable':'compact';}document.documentElement.setAttribute('data-density',v);}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <OrgNavProvider>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <SiteChrome />
          <main id="main-content">{children}</main>
          <Footer />
          <BottomNav />
        </OrgNavProvider>
        {/* Install prompts are mounted per-context, not globally: the fan prompt on
            tournament pages and the member prompt in authenticated shells. The
            marketing root no longer shows an install banner. */}
        {/* Service worker registration — browser-only, renders nothing */}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
