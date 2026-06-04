import type { Metadata } from 'next';

// Provides PWA manifest for auth pages (signup mounts InstallAppPrompt but
// is 'use client' and cannot export metadata itself).
export const metadata: Metadata = {
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'FieldLogicHQ',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
