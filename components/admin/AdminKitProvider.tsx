'use client';
/**
 * The admin kit switch, handed from the server layout (which read the cookie — `lib/admin-kit-preview.ts`)
 * to every client component that renders a kit or a legacy version of itself: the frame, the page
 * header, the restyled pages. Server-decided, so the first paint is already the right one.
 *
 * ⚠ Defaults to OFF: a component rendered outside the admin layout (a test, a stray mount) gets the
 * legacy look, never a half-built kit.
 */
import { createContext, useContext, type ReactNode } from 'react';

const AdminKitContext = createContext(false);

export function AdminKitProvider({ on, children }: { on: boolean; children: ReactNode }) {
  return <AdminKitContext.Provider value={on}>{children}</AdminKitContext.Provider>;
}

/** Is the admin kit on for this request? */
export function useAdminKit(): boolean {
  return useContext(AdminKitContext);
}
