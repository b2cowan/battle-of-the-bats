/**
 * registration-access.ts — who may manage a tournament's registrations. Client-safe and pure: the routes ask it and the Teams
 * screen reads the same answer, so a button never shows for a member the server will refuse.
 *
 * ⚖ One rule (Board Ready W2 fix E, owner 2026-11-11, sweep 3 finding 5): the tournament team export, and the private admin
 * notes on a registration, belong to whoever may manage registrations — the capability the sibling actions (bulk edits,
 * payment reminders, resend access, import) already ask, or the one who creates tournaments (as import has always allowed).
 * Tournament staff (schedule and check-in) read the team list and nothing past it.
 */
import { hasCapability } from './roles.ts';
import type { OrgRole } from './types';

export function canManageRegistrations(
  role: OrgRole | string | null | undefined,
  capabilities: Record<string, boolean> | null | undefined,
): boolean {
  if (!role) return false;
  const r = role as OrgRole;
  return hasCapability(r, capabilities ?? null, 'manage_registrations') || hasCapability(r, capabilities ?? null, 'create_tournaments');
}
