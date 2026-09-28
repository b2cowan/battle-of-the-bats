'use client';
/**
 * The admin kit switch, handed from the server layout (which read the cookie — `lib/admin-kit-preview.ts`)
 * to every client component that renders a kit or a legacy version of itself: the frame, the page
 * header, the restyled pages. Server-decided, so the first paint is already the right one.
 *
 * ⚠ Defaults to OFF: a component rendered outside the admin layout (a test, a stray mount) gets the
 * legacy look, never a half-built kit.
 */
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { adminKitAttr, guestKitAttr } from '@/lib/admin-kit-preview';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import { KIT_BUTTON, KIT_INK, kitStyler } from './kit/kit-inline';

const AdminKitContext = createContext(false);
/** WHICH marker a portal carries: the admin's pair, or — inside a volunteer shell — the guest pair that
 *  pins the warm palette (slice 5, R3). The layout that read the switch says which; nothing else. */
const KitMarkerContext = createContext<Readonly<Record<string, string>>>(adminKitAttr);

/** `guest`: the volunteer shells (the scorekeeper, the gate) — the same switch, the fixed-warm marker. */
export function AdminKitProvider({ on, guest = false, children }: { on: boolean; guest?: boolean; children: ReactNode }) {
  const kit = <AdminKitContext.Provider value={on}>{children}</AdminKitContext.Provider>;
  return guest ? <KitMarkerContext.Provider value={guestKitAttr}>{kit}</KitMarkerContext.Provider> : kit;
}

/** Is the admin kit on for this request? */
export function useAdminKit(): boolean {
  return useContext(AdminKitContext);
}

const NO_ATTR: Readonly<Record<string, string>> = {};

/** The marker the layout puts on the shell while the switch is on, nothing while it is off — as the
 *  context says, so nothing inside a public preview (its island turns the kit off, R2, `AdminChrome`). */
function usePortalKitAttr(): Readonly<Record<string, string>> {
  const marker = useContext(KitMarkerContext);
  return useAdminKit() ? marker : NO_ATTR;
}

/**
 * The admin kit for a surface PORTALED out of the admin shell (Admin Design Continuity slice 4c). A
 * `createPortal(…, document.body)` renders BESIDE the shell, never inside it, so no `[data-admin-kit]`
 * rule can reach it and the warm palette never applies — the shared bottom sheet and the admin chat's
 * rooms and manage panels were silently legacy under the switch until 4c. Wrap the portal's content in
 * this: with the switch on, one `display: contents` wrapper ABOVE the portal's root carries the marker (the
 * admin layout's own shape — and a marker on the styled root itself would not satisfy that root's own
 * `[data-admin-kit] .x` rule); with it off, the children exactly as they were — no element, no attribute.
 * It decides nothing: it forwards the layout's decision through the context. ⚠ The one place besides the
 * admin layout that may touch `adminKitAttr` (`tests/unit/admin-kit-switch-guard.test.ts`).
 */
export function PortalKitRoot({ children }: { children: ReactNode }) {
  const attr = usePortalKitAttr();
  return attr === NO_ATTR ? <>{children}</> : <div style={{ display: 'contents' }} {...attr}>{children}</div>;
}

/**
 * The volunteer shells' way onto the kit (slice 5, ruling R3) — one piece, so the scorekeeper and the gate
 * cannot drift. Their layouts read the switch on the server and pass it here. On: the kit's context in its
 * GUEST form (a portal opened inside carries the guest pair), the marker on a box-less wrapper ABOVE the
 * shell (the admin layout's placement, for its reason), and the status bar tinted warm to match. Off: the
 * page exactly as it was — no provider, no element, no attribute.
 */
export function GuestKitRoot({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <AdminKitProvider on guest>
      <div style={{ display: 'contents' }} {...guestKitAttr}>
        <CoachThemeColor fixed="warm" />
        {children}
      </div>
    </AdminKitProvider>
  );
}

/**
 * `kx(legacy, kit)` — an inline style that wears the kit's patch while the switch is on, and is
 * EXACTLY `legacy` (the same object) while it is off (Admin Design Continuity slice 2). For the
 * admin's hand-set inline colours, which no stylesheet can reach. Patches hold tokens only
 * (`components/admin/kit/kit-inline.ts`); the release slice folds each patch in and deletes this.
 */
export function useKitStyle(): (legacy: CSSProperties, kit: CSSProperties) => CSSProperties {
  const on = useAdminKit();
  return useMemo(() => kitStyler(on), [on]);
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

/** A required field's asterisk: today's red while the switch is off, the label's own ink on the kit (the
 *  portal-wide 2026-08-25 ruling — red means something went wrong). One constant per switch state. */
const ASTERISK_LEGACY: CSSProperties = { color: 'var(--danger-light)' };
const ASTERISK_KIT: CSSProperties = { ...ASTERISK_LEGACY, ...KIT_INK.asterisk };
export function useKitAsterisk(): CSSProperties {
  return useAdminKit() ? ASTERISK_KIT : ASTERISK_LEGACY;
}
