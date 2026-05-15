import type { Metadata } from 'next';
import { Inter, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import SiteChrome from '@/components/SiteChrome';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { OrgNavProvider } from '@/components/OrgNavContext';

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
  manifest: '/manifest.json',
};

// Inline script runs before first paint to prevent FOUC when user has saved a light mode preference.
const colorModeScript = `(function(){try{var m=localStorage.getItem('public-color-mode');if(m==='light'){document.documentElement.setAttribute('data-color-mode','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} ${ibmPlexMono.variable}`} data-scroll-behavior="smooth">
      {/* eslint-disable-next-line react/no-danger */}
      <script dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      <body>
        <OrgNavProvider>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <SiteChrome />
          <main id="main-content">{children}</main>
          <Footer />
          <BottomNav />
        </OrgNavProvider>
      </body>
    </html>
  );
}
