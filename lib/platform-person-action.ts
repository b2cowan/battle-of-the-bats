/**
 * The one front door every action on a person goes through (the person record's doors: reset link, confirm email, sign
 * out everywhere, ban, change name or email; Support console Stage 2). In this order, before the action does anything:
 *
 *   1. the `person_support` power (Support and Super admin; Billing lost it, A1);
 *   2. the person, read by ACCOUNT NUMBER through the sign-in lookup — never from an email the request carries, so a
 *      reset link or an audit row always names the account the record shows;
 *   3. the staff refusal: a non-super-admin never acts on a staff account, or sets or sends to a staff email
 *      (`staffTargetRefusal`, 2026-10-16) — written once, here, so a new action cannot leave it out;
 *   4. a reason (R4: every change from Stage 2 on keeps its reason).
 * The audit entry then names the person the same way every time — `personAuditValue` — so the person's Story finds it.
 * Delete is the one action that does not use it: it is Super admin's alone (no staff refusal needed) and confirms by the
 * typed email.
 */
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requirePlatformPower, type PlatformRole } from './platform-auth';
import { staffTargetRefusal } from './platform-staff-guard';
import { personById, type PlatformPerson } from './platform-people-lookup';

export async function personForAction(id: string): Promise<{ person: PlatformPerson; response: null } | { person: null; response: NextResponse }> {
  const person = await personById(id).catch(() => null);
  if (!person) return { person: null, response: NextResponse.json({ error: 'This person was not found.' }, { status: 404 }) };
  return { person, response: null };
}

export function readReason(body: unknown): string {
  const reason = (body as { reason?: unknown } | null)?.reason;
  return typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';
}

export function reasonRequired() {
  return NextResponse.json({ error: 'Say why before going ahead.' }, { status: 400 });
}

export type PersonAction<B> = { auth: { user: User; role: PlatformRole }; person: PlatformPerson; body: B; reason: string };

/**
 * Steps 1–4 above. `emailsFrom` names any further email the action would set or send to (the update's new email), so
 * the staff refusal covers it too.
 */
export async function personActionContext<B extends Record<string, unknown>>(
  req: Request,
  id: string,
  emailsFrom: (body: B) => Array<string | null | undefined> = () => [],
): Promise<{ action: PersonAction<B>; response: null } | { action: null; response: NextResponse }> {
  const auth = await requirePlatformPower('person_support');
  if (auth.response) return { action: null, response: auth.response };
  const body = (await req.json().catch(() => ({}))) as B;
  const found = await personForAction(id);
  if (found.response) return { action: null, response: found.response };
  const staffRefused = await staffTargetRefusal(auth.role, { userId: id, emails: [found.person.email, ...emailsFrom(body)] });
  if (staffRefused) return { action: null, response: staffRefused };
  const reason = readReason(body);
  if (!reason) return { action: null, response: reasonRequired() };
  return { action: { auth: { user: auth.user, role: auth.role }, person: found.person, body, reason }, response: null };
}

/** The person, named the one way, with the reason — the `new_value` of every person action from Stage 2 on. */
export function personAuditValue(person: Pick<PlatformPerson, 'id' | 'email'>, extra: Record<string, unknown> = {}) {
  return { userId: person.id, email: person.email, ...extra };
}
