'use client';
/**
 * WHERE a component is drawing: inside the admin (or a volunteer shell), or somewhere else. The admin
 * layout and both volunteer shells turn it on (since the release, 2026-09-28, in every build — the dev-only
 * switch that decided it is gone; the markers live in `lib/admin-kit-marker.ts`). Everywhere else the
 * answer is OFF, and that is not a leftover: the tournament preview island (R2, `AdminChrome`) turns it off
 * so a public page previewed in the admin stays the public page, and a part shared with another surface —
 * the bottom sheet on the public follow sheets, the chat panels, the help drawer — asks it before carrying
 * the admin's marker into a portal (`PortalKitRoot`).
 *
 * ⚠ What IS left over: an admin page's own `useAdminKit()` false branch and its `kx(legacy, kit)` legacy
 * half. An admin page never renders outside the admin layout, so those are dead. Admin Design Continuity
 * (closed 2026-09-30) retired them from every screen no redesign is coming for; the rest belong to the
 * tournament admin redesign and Club Tier, retired as each stage rebuilds its screens, and
 * `scripts/check-admin-old-look.mjs` refuses a new one. The helpers below go with their last caller.
 */
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { adminKitAttr, guestKitAttr } from '@/lib/admin-kit-marker';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import { KIT_BUTTON, KIT_INK, kitStyler } from './kit/kit-inline';

const AdminKitContext = createContext(false);
/** WHICH marker a portal carries: the admin's pair, or — inside a volunteer shell — the guest pair that
 *  pins the warm palette (slice 5, R3). The shell's layout says which; nothing else. */
const KitMarkerContext = createContext<Readonly<Record<string, string>>>(adminKitAttr);

/** `guest`: the volunteer shells (the scorekeeper, the gate) — the same kit, the fixed-warm marker. */
export function AdminKitProvider({ on, guest = false, children }: { on: boolean; guest?: boolean; children: ReactNode }) {
  const kit = <AdminKitContext.Provider value={on}>{children}</AdminKitContext.Provider>;
  return guest ? <KitMarkerContext.Provider value={guestKitAttr}>{kit}</KitMarkerContext.Provider> : kit;
}

/** Is this component drawing inside the admin (or a volunteer shell) — not in a public preview, not on
 *  another surface? */
export function useAdminKit(): boolean {
  return useContext(AdminKitContext);
}

const NO_ATTR: Readonly<Record<string, string>> = {};

/** The marker the layout puts on the shell, or nothing where the context is off — so nothing inside a
 *  public preview (its island turns the kit off, R2, `AdminChrome`) or on another surface. */
function usePortalKitAttr(): Readonly<Record<string, string>> {
  const marker = useContext(KitMarkerContext);
  return useAdminKit() ? marker : NO_ATTR;
}

/**
 * The admin kit for a surface PORTALED out of the admin shell (Admin Design Continuity slice 4c). A
 * `createPortal(…, document.body)` renders BESIDE the shell, never inside it, so no `[data-admin-kit]`
 * rule can reach it and the warm palette never applies — the shared bottom sheet and the admin chat's
 * rooms and manage panels were silently legacy under the switch until 4c. Wrap the portal's content in
 * this: inside the admin, one `display: contents` wrapper ABOVE the portal's root carries the marker (the
 * admin layout's own shape — and a marker on the styled root itself would not satisfy that root's own
 * `[data-admin-kit] .x` rule); anywhere else (a public page, a preview island, the coaches portal), the
 * children exactly as they were — no element, no attribute.
 * It decides nothing: it forwards the layout's decision through the context. ⚠ The one place besides the
 * admin layout that may touch `adminKitAttr` (`tests/unit/admin-kit-switch-guard.test.ts`).
 */
export function PortalKitRoot({ children }: { children: ReactNode }) {
  const attr = usePortalKitAttr();
  return attr === NO_ATTR ? <>{children}</> : <div style={{ display: 'contents' }} {...attr}>{children}</div>;
}

/**
 * The volunteer shells' way onto the kit (slice 5, ruling R3) — one piece, so the scorekeeper and the gate
 * cannot drift. No off state: since the release it takes nothing but what it wraps (the switch's `on` prop
 * went at Part B's closing step). The kit's context in its GUEST form (a portal opened inside carries the
 * guest pair), the marker on a box-less wrapper ABOVE the shell (the admin layout's placement, for its
 * reason), and the status bar tinted warm to match.
 */
export function GuestKitRoot({ children }: { children: ReactNode }) {
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
 * `kx(legacy, kit)` — an inline style that wears the kit's patch inside the admin, and is EXACTLY
 * `legacy` (the same object) where the context is off (Admin Design Continuity slice 2). For the
 * admin's hand-set inline colours, which no stylesheet can reach. Patches hold tokens only
 * (`components/admin/kit/kit-inline.ts`). Every caller renders inside the admin or a volunteer shell,
 * where the legacy half is dead: the redesign stage that rebuilds each caller folds its patches in, and
 * this goes with the last caller.
 */
export function useKitStyle(): (legacy: CSSProperties, kit: CSSProperties) => CSSProperties {
  const on = useAdminKit();
  return useMemo(() => kitStyler(on), [on]);
}

/** A page's three hand-set button styles, each wearing the kit's button inside the admin. Pass a
 *  module-level object: the result is built once per context value, not on every render of a form. */
export function useKitButtons(legacy: { primary: CSSProperties; secondary: CSSProperties; danger: CSSProperties }) {
  const kx = useKitStyle();
  return useMemo(() => ({
    primary: kx(legacy.primary, KIT_BUTTON.primary),
    secondary: kx(legacy.secondary, KIT_BUTTON.secondary),
    danger: kx(legacy.danger, KIT_BUTTON.danger),
  }), [kx, legacy]);
}

/** A required field's asterisk: the label's own ink on the kit (the portal-wide 2026-08-25 ruling — red
 *  means something went wrong); the old red where the context is off. One constant per context value. */
const ASTERISK_LEGACY: CSSProperties = { color: 'var(--danger-light)' };
const ASTERISK_KIT: CSSProperties = { ...ASTERISK_LEGACY, ...KIT_INK.asterisk };
export function useKitAsterisk(): CSSProperties {
  return useAdminKit() ? ASTERISK_KIT : ASTERISK_LEGACY;
}
