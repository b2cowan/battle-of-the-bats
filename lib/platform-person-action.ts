/**
 * What every action on a person (the person record's doors: reset link, confirm email, sign out everywhere, ban, change
 * name or email, delete) shares (Support console Stage 2).
 *
 *   • the person is read by ACCOUNT NUMBER through the sign-in lookup — never from an email the request carries, so a
 *     reset link or an audit row always names the account the record shows;
 *   • a reason is required (R4: every change from Stage 2 on keeps its reason);
 *   • the audit entry names the person the same way every time — `{ userId, email, reason, … }` in `new_value` — so the
 *     person's Story finds it (older entries held the email or the id as a bare value; the Story reads both).
 */
import { NextResponse } from 'next/server';
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

/** The person, named the one way, with the reason — the `new_value` of every person action from Stage 2 on. */
export function personAuditValue(person: Pick<PlatformPerson, 'id' | 'email'>, reason: string, extra: Record<string, unknown> = {}) {
  return { userId: person.id, email: person.email, reason, ...extra };
}
