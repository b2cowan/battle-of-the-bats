import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { readRealSeats } from '@/lib/org-membership-policy';
import { captureAndJson, withObservability } from '@/lib/observability';
import { requireAcceptance } from '@/lib/legal-acceptance';
import { getSignedInUser } from '@/lib/two-step-session';
import { hasLiveInvitation } from '@/lib/invite-reconciliation';
import { planStepPath } from '@/lib/start-door';
import { isPaidDoorOpen } from '@/lib/start-plan-server';
import { getActiveOwnedTeamWorkspace } from '@/lib/team-workspace-owned';
import { clearStartDoor } from '@/lib/start-door-server';
import { CLAIM_WORDS, claimRecordText } from '@/lib/preview-claim';
import { claimPreviewClub, holdsSeatIn, openClaimPass, readClaimDoor, claimVisitorKey } from '@/lib/preview-claim-server';

/**
 * POST /api/start/claim — THE CLAIM of a preview club (Club Website Track P, Session P3; owner rulings T7–T9, T14, T16;
 * drawing tab 6.3). Body `{ slug, pass, authority: true }`.
 *
 * A new door that makes someone an organization's owner, so it holds every rule Start a club's own door holds
 * (`app/api/org/create/route.ts`): signed in, not staff, the CURRENT Terms (/legal: it joins the
 * acceptance census), the one-club rule, no live invitation, Club on sale, and a Premium coach's portal. Then the pass
 * (a right code, still the club's current code), and the authority tick, kept word for word in the claim record.
 *
 * The claim itself is ONE database step (mig 540 `claim_preview_club`): the sample cleared, the marker cleared, the
 * owner seated, the plan they came for recorded (T9: Start a club's own plan step follows, unchanged), the record
 * written. Every failure leaves the preview as it was; "didn't finish" is reported to Errors.
 *
 * Answers: 200 `{ next }` (the plan step) · 401 · 403/409 `{ error, code }` · 410 `{ state }` (claimed / removed / pass) ·
 * 500 `{ error, code: 'did_not_finish' }`.
 */
export const POST = withObservability(async (req: Request) => {
  try {
    const supabase = await createClient();
    const user = await getSignedInUser(supabase);
    if (!user?.id || !user.email) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    if (await isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: CLAIM_WORDS.err.staff, code: 'staff' }, { status: 403 });
    }
    const terms = await requireAcceptance(user);
    if (!terms.ok) return terms.response;

    const body = await req.json().catch(() => ({})) as { slug?: unknown; pass?: unknown; authority?: unknown };
    const slug = typeof body.slug === 'string' ? body.slug.trim().slice(0, 100) : '';
    const pass = typeof body.pass === 'string' ? body.pass.slice(0, 80) : '';
    if (!slug) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const opened = await openClaimPass(slug, pass);
    if (!opened) {
      // The claimer's own claim already went through (a lost answer, a second tab): carry on to the plan step.
      const already = await readClaimDoor(slug, claimVisitorKey(req));
      if (already.state === 'claimed' && await holdsSeatIn(user.id, already.club.orgId)) {
        return NextResponse.json({ next: planStepPath(already.club.slug, null) });
      }
      // Say which: claimed or removed since the code was typed, or the pass is no longer good (a new code, a day later).
      const door = await readClaimDoor(slug, claimVisitorKey(req));
      const state = door.state === 'claimed' || door.state === 'removed' ? door.state : 'pass';
      return NextResponse.json({ state, removedOn: door.state !== 'missing' ? door.removedOn : null }, { status: 410 });
    }
    const club = opened.club;

    // One account runs one club (decision 2026-06-19): the same seat read Start a club's claim-then-verify uses, here to
    // name the other club in the refusal (tab 6.7). Like the start door, a failed read lets the request through.
    const seats = await readRealSeats(user.id);
    const elsewhere = seats.filter(s => s.organizationId !== club.orgId);
    if (elsewhere.length > 0) {
      const { data: own } = await supabaseAdmin.from('organizations').select('name').eq('id', elsewhere[0].organizationId).maybeSingle();
      const ownName = (own as { name: string } | null)?.name;
      return NextResponse.json({
        error: ownName ? CLAIM_WORDS.err.otherClub(ownName, club.name) : CLAIM_WORDS.err.otherClubUnnamed(club.name),
        code: 'one_club',
      }, { status: 403 });
    }
    if (await hasLiveInvitation(user.id)) {
      return NextResponse.json({
        error: `You have a pending invitation. Accept it from your home screen, or claim ${club.name} with a different email.`,
        code: 'invitation',
      }, { status: 409 });
    }
    if (await getActiveOwnedTeamWorkspace(user.id)) {
      return NextResponse.json({
        error: `Your account runs a Coaches Portal, which becomes your club when you start one. Claim ${club.name} with a different email, or write to support@fieldlogichq.ca.`,
        code: 'start_club_in_place',
      }, { status: 409 });
    }
    // T9: exactly what Start a club starts, re-checked against the live gate.
    if (!(await isPaidDoorOpen('club'))) {
      return NextResponse.json({ error: CLAIM_WORDS.err.notOnSale, code: 'plan_not_on_sale' }, { status: 403 });
    }
    if (body.authority !== true) {
      return NextResponse.json({ error: CLAIM_WORDS.authorityMissing, code: 'authority' }, { status: 400 });
    }

    const result = await claimPreviewClub({
      orgId: club.orgId,
      code: opened.code,
      user: { id: user.id, email: user.email },
      // The record keeps what the person read and ticked: /legal's paragraph and the authority line (P3 review, item 1).
      boxText: claimRecordText(club.name),
      startPlan: 'club',
    });
    if (result.ok) {
      // Every path that gives an account its own club forgets the remembered start door (lib/start-door-server.ts), or
      // Home shows a "Not named yet" club beside the one just claimed (/billing 2026-11-25).
      await clearStartDoor(user.id, ['club']);
      return NextResponse.json({ next: planStepPath(result.slug, null) });
    }
    if (result.kind === 'one_club') {
      return NextResponse.json({ error: CLAIM_WORDS.err.otherClubUnnamed(club.name), code: 'one_club' }, { status: 403 });
    }
    if (result.kind === 'not_open') {
      if (await holdsSeatIn(user.id, club.orgId)) return NextResponse.json({ next: planStepPath(club.slug, null) });
      const door = await readClaimDoor(slug, claimVisitorKey(req));
      const state = door.state === 'removed' ? 'removed' : 'claimed';
      return NextResponse.json({ state, removedOn: door.state !== 'missing' ? door.removedOn : null }, { status: 410 });
    }
    if (result.kind === 'code') return NextResponse.json({ state: 'pass' }, { status: 410 });
    return NextResponse.json({ error: CLAIM_WORDS.err.didNotFinish, code: 'did_not_finish' }, { status: 500 });
  } catch (err) {
    return captureAndJson(err, { error: CLAIM_WORDS.err.didNotFinish, code: 'did_not_finish' }, 500);
  }
}, { route: '/api/start/claim' });
