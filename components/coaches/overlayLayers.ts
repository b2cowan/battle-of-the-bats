/**
 * A window opened from a control INSIDE another open window — the payee picker's "Manage payees…" inside
 * a bill or the Add a bill form (Ledger Parity D8, 2026-10-02) — stands one level above it.
 *
 * ⚠ WHY A NUMBER, NOT ORDER IN THE PAGE. Overlays at one level stack by where they sit in the page: the
 * Payees window is drawn BEFORE the bill and the money form, so a bill opened from a payee's entries lands
 * over it and closing the bill returns to the payee. Opened the other way round — from inside the bill —
 * it would open UNDER the form that opened it. So that one case is raised: above `.modalOverlay` (200, and
 * 400 on a phone, where it covers the bottom nav), below the global confirm (1000), which must cover it.
 * Set inline, so it never depends on which stylesheet loads last.
 *
 * ⚠ Everything such a window opens (its questions) is raised with it, or it would open underneath; and a
 * floating save word lives INSIDE the raised window (its 250 would otherwise sit under it at a desk).
 */
export const RAISED_OVERLAY_Z = 401;
