'use client';
/**
 * The admin kit switch, handed from the server layout (which read the cookie — `lib/admin-kit-preview.ts`)
 * to every client component that renders a kit or a legacy version of itself: the frame, the page
 * header, the restyled pages. Server-decided, so the first paint is already the right one.
 *
 * ⚠ Defaults to OFF: a component rendered outside the admin layout (a test, a stray mount) gets the
 * legacy look, never a half-built kit.
 */
import { createContext, useCallback, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { KIT_BUTTON } from './kit/kit-inline';

const AdminKitContext = createContext(false);

export function AdminKitProvider({ on, children }: { on: boolean; children: ReactNode }) {
  return <AdminKitContext.Provider value={on}>{children}</AdminKitContext.Provider>;
}

/** Is the admin kit on for this request? */
export function useAdminKit(): boolean {
  return useContext(AdminKitContext);
}

/**
 * `kx(legacy, kit)` — an inline style that wears the kit's patch while the switch is on, and is
 * EXACTLY `legacy` (the same object) while it is off (Admin Design Continuity slice 2). For the
 * admin's hand-set inline colours, which no stylesheet can reach. Patches hold tokens only
 * (`components/admin/kit/kit-inline.ts`); the release slice folds each patch in and deletes this.
 */
export function useKitStyle(): (legacy: CSSProperties, kit: CSSProperties) => CSSProperties {
  const on = useAdminKit();
  return useCallback((legacy, kit) => (on ? { ...legacy, ...kit } : legacy), [on]);
}

/** A page's three hand-set button styles, each wearing the kit's button while the switch is on. Pass a
 *  module-level object: the result is built once per switch state, not on every render of a form. */
export function useKitButtons(legacy: { primary: CSSProperties; secondary: CSSProperties; danger: CSSProperties }) {
  const kx = useKitStyle();
  return useMemo(() => ({
    primary: kx(legacy.primary, KIT_BUTTON.primary),
    secondary: kx(legacy.secondary, KIT_BUTTON.secondary),
    danger: kx(legacy.danger, KIT_BUTTON.danger),
  }), [kx, legacy]);
}
