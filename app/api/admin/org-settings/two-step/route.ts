import { NextResponse } from 'next/server';
import { getAuthContextWithRole, getSessionTwoStep, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { hasVerifiedFactor } from '@/lib/two-step-session';
import { TWO_STEP_GRACE_DAYS } from '@/lib/two-step-rule';
import { getUserDisplayName } from '@/lib/user-display';
import { boardRecipients, sendTwoStepEmail, twoStepRequirementOffEmail } from '@/lib/two-step-emails';

/**
 * ORGANIZATION › SETTINGS › TWO-STEP SIGN-IN — the club's two switches (Board Ready · two-step sign-in, Part 3; drawings
 * tab 8; ask 1 as the owner amended it, 2026-11-10).
 *
 *   - "Require it for the board" and "Also require it for coaches", both off by default. NULL is off; a time is ON and is
 *     when it was turned on (each covered person's 14 days count from it, lib/two-step-rule.ts).
 *   - The OWNER changes them. An admin reads them (ruled 2026-11-11: admins get Settings with only this card, read-only).
 *   - The owner must have two-step ON to change either switch (on: so it can always be turned off again; off: owner ruling
 *     2026-11-11, so a stolen password for an unprotected owner cannot remove it).
 *   - Turning one OFF asks for the owner's code (the one window, `requireFreshCode`, after every check and before the
 *     write) and emails the club's other owners, admins and treasurer, so a stolen owner password can't quietly remove it.
 *   - Every change is a line in the club's audit log.
 */

type Which = 'board' | 'coaches';
const COLUMN: Record<Which, 'two_step_board_required_since' | 'two_step_coaches_required_since'> = {
  board: 'two_step_board_required_since',
  coaches: 'two_step_coaches_required_since',
};
type Row = { two_step_board_required_since: string | null; two_step_coaches_required_since: string | null; is_test_organization: boolean | null };

async function readSwitches(orgId: string): Promise<Row | null> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('two_step_board_required_since, two_step_coaches_required_since, is_test_organization')
    .eq('id', orgId)
    .maybeSingle<Row>();
  return data ?? null;
}

async function answer(row: Row, role: string) {
  const isOwner = role === 'owner';
  const state = isOwner ? await getSessionTwoStep() : null;
  return {
    board: { since: row.two_step_board_required_since },
    coaches: { since: row.two_step_coaches_required_since },
    graceDays: TWO_STEP_GRACE_DAYS,
    canChange: isOwner,
    /** The owner's own two-step is on (a requirement can be turned on). Only ever said to the owner. */
    ownerHasTwoStep: isOwner ? hasVerifiedFactor(state?.user) : null,
    isTestOrganization: row.is_test_organization === true,
  };
}

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  const row = await readSwitches(ctx.org.id);
  if (!row) return NextResponse.json({ error: 'We couldn’t read the setting.' }, { status: 500 });
  return NextResponse.json(await answer(row, ctx.role));
}, { route: '/api/admin/org-settings/two-step' });

/** PATCH `{ which: 'board' | 'coaches', on: boolean }` — the owner's change of one switch. */
export const PATCH = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Only the owner changes this.' }, { status: 403 });

  const body = await req.json().catch(() => null) as { which?: unknown; on?: unknown } | null;
  const which = body?.which === 'board' || body?.which === 'coaches' ? body.which : null;
  if (!which || typeof body?.on !== 'boolean') return NextResponse.json({ error: 'Choose a requirement to change.' }, { status: 400 });
  const on = body.on;

  const row = await readSwitches(ctx.org.id);
  if (!row) return NextResponse.json({ error: 'We couldn’t read the setting.' }, { status: 500 });
  const column = COLUMN[which];
  const isOn = Boolean(row[column]);
  // Already as asked: nothing changes, nothing is written or sent (a double press, or two tabs).
  if (isOn === on) return NextResponse.json(await answer(row, ctx.role));

  // The owner's own two-step, both ways (owner ruling 2026-11-11, Part 3 /review call 1): ON so it can always be turned
  // off again; OFF so a stolen password for an unprotected owner cannot quietly remove the club's requirement.
  const state = await getSessionTwoStep();
  if (!hasVerifiedFactor(state?.user)) {
    return NextResponse.json({
      error: on
        ? 'Turn on two-step sign-in for your own account first, so you can always turn this off again.'
        : 'Turn on two-step sign-in for your own account first. Then you can stop requiring it.',
      code: 'owner_two_step_off',
    }, { status: 409 });
  }
  if (!on) {
    // The move a stolen owner password would make: a code from the last 15 minutes, after every check above.
    const stale = await requireFreshCode();
    if (stale) return stale;
  }

  const nowIso = new Date().toISOString();
  // Only from the state this request read, so a change made meanwhile in another tab is never overwritten blind.
  let write = supabaseAdmin.from('organizations').update({ [column]: on ? nowIso : null }).eq('id', ctx.org.id);
  write = isOn ? write.not(column, 'is', null) : write.is(column, null);
  const { data: written, error } = await write.select('id');
  if (error) return captureAndJson(error, { error: 'We couldn’t save that. Try again.' }, 500);
  const after = await readSwitches(ctx.org.id);
  if (!written?.length) return NextResponse.json(after ? await answer(after, ctx.role) : { error: 'Try again.' }, after ? { status: 200 } : { status: 500 });

  await writeOrgAudit(ctx.org.id, ctx.user.id, null, on ? 'two_step_requirement_on' : 'two_step_requirement_off', { which });

  if (!on) {
    const { data: me } = await supabaseAdmin
      .from('organization_members')
      .select('display_name')
      .eq('organization_id', ctx.org.id)
      .eq('user_id', ctx.user.id)
      .maybeSingle<{ display_name: string | null }>();
    const ownerName = me?.display_name?.trim() || getUserDisplayName(ctx.user) || 'The owner';
    const mail = twoStepRequirementOffEmail({ orgName: ctx.org.name, ownerName, which, atIso: nowIso });
    const to = await boardRecipients(ctx.org.id, ctx.user.id);
    await Promise.all(to.map(r => sendTwoStepEmail(r.email, mail, 'two_step_requirement_off', {
      orgId: ctx.org.id,
      askedBy: ctx.user.id,
      idempotencyKey: `two-step-off:${ctx.org.id}:${which}:${nowIso}:${r.userId}`,
    })));
  }

  return NextResponse.json(after ? await answer(after, ctx.role) : { ok: true });
}, { route: '/api/admin/org-settings/two-step' });
