import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { canMarkLeagueFeePaid, setLeagueFeePaid, voidLeagueRegistrationFee } from '@/lib/league-fee-paid';
import { moveRefused } from '@/lib/club-money-route';
import { getLeagueSeasonById } from '@/lib/db';
import { changeLeagueDivision, moveLeagueRegistration } from '@/lib/league-registration-place';
import { registrationOwes } from '@/lib/league-price';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason, teamsInSeason } from '@/lib/league-season-scope';
import {
  leagueAdminApprovedHtml,
  leagueAdminWaitlistedHtml,
  leagueWaitlistPromotedHtml,
  leagueRegistrationDeclinedHtml,
} from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { systemMailFace } from '@/lib/club-email-context';
import type { LeagueRegistrationStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function mapRow(row: any) {
  return {
    id:                  row.id,
    seasonId:            row.season_id,
    divisionId:          row.division_id ?? null,
    playerFirstName:     row.player_first_name,
    playerLastName:      row.player_last_name,
    playerDateOfBirth:   row.player_date_of_birth ?? null,
    playerJerseyPref:    row.player_jersey_pref ?? null,
    playerPositionPref:  row.player_position_pref ?? null,
    playerNotes:         row.player_notes ?? null,
    guardianFirstName:   row.guardian_first_name,
    guardianLastName:    row.guardian_last_name,
    guardianEmail:       row.guardian_email,
    guardianPhone:       row.guardian_phone ?? null,
    status:              row.status as LeagueRegistrationStatus,
    waitlistPosition:    row.waitlist_position ?? null,
    teamId:              row.team_id ?? null,
    registrationFeePaid: row.registration_fee_paid,
    feeEntryId:          row.fee_entry_id ?? null,
    adminNotes:          row.admin_notes ?? null,
    source:              row.source,
    waiverAcceptedAt:    row.waiver_accepted_at ?? null,
    signupRef:           row.signup_ref ?? null,
    signupPosition:      row.signup_position ?? null,
    feeAmount:           row.fee_amount != null ? Number(row.fee_amount) : null,
    registeredAt:        row.registered_at,
    updatedAt:           row.updated_at,
  };
}

async function fetchReg(regId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('id', regId)
    .eq('season_id', seasonId)
    .single();
  return data ? mapRow(data) : null;
}

/** The waitlist moved up (inside the same locked database step that freed the spot, mig 362): tell that family. */
function emailPromoted(
  org: Parameters<typeof systemMailFace>[0] & { slug: string; name: string },
  season: { name: string; slug: string; registrationFee: number | null; howToPay: string | null },
  seasonId: string,
  promotedId: string,
): void {
  void (async () => {
    try {
      const next = await fetchReg(promotedId, seasonId);
      if (!next) return;
      let divisionName = 'your division';
      if (next.divisionId) {
        const { data: div } = await supabaseAdmin.from('league_divisions').select('name').eq('id', next.divisionId).single();
        if (div) divisionName = div.name;
      }
      const face = await systemMailFace(org);
      await sendTransactionalEmail({
        key: 'league_waitlist_promoted',
        to: next.guardianEmail,
        vars: {
          guardianFirstName: next.guardianFirstName,
          playerFirstName:   next.playerFirstName,
          playerLastName:    next.playerLastName,
          seasonName:        season.name,
          divisionName,
        },
        defaultSubject: `A spot opened: ${next.playerFirstName} is accepted — ${season.name}`,
        // Q4: the promotion carries the price this child signed up at and the club's how-to-pay words.
        defaultHtml: leagueWaitlistPromotedHtml({
          playerFirstName:  next.playerFirstName,
          playerLastName:   next.playerLastName,
          guardianFirstName: next.guardianFirstName,
          seasonName:       season.name,
          divisionName,
          registrationId:   next.id,
          reference:        next.signupRef,
          fee:              registrationOwes(next, season),
          howToPay:         season.howToPay,
          clubName:         org.name,
          statusPath:       `/${org.slug}/league/${season.slug}/status`,
          face,
        }),
        family: face ? { face, reason: `${next.playerFirstName} was signed up for ${season.name}` } : undefined,
      });
    } catch (e) { console.error('[email] leagueWaitlistPromotedHtml failed', e); }
  })();
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; regId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId, regId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const reg = await fetchReg(regId, seasonId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  return NextResponse.json({ registration: reg });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; regId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId, regId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const reg = await fetchReg(regId, seasonId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  const body = await req.json();

  // ── feePaid ──────────────────────────────────────────────────────────────────
  // ONE write, shared with the family record's Record a payment (Club Tier Stage 5c, Part A — lib/league-fee-paid.ts):
  // who may, the fiscal year's lock, the flip and the fee line all live there. It stays open on a finished season (Q16).
  if ('feePaid' in body) {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    const refused = await setLeagueFeePaid(ctx!, { season, reg }, Boolean(body.feePaid));
    if (refused) return moveRefused(refused);
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── adminNotes only ──────────────────────────────────────────────────────────
  if ('adminNotes' in body && !('status' in body) && !('divisionId' in body) && !('teamId' in body)) {
    const refused = houseLeagueRefusal(ctx, 'register', season);
    if (refused) return refused;
    await supabaseAdmin
      .from('league_registrations')
      .update({ admin_notes: body.adminNotes ?? null, updated_at: new Date().toISOString() })
      .eq('id', regId);
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── divisionId / teamId reassignment ────────────────────────────────────────
  if ('divisionId' in body || 'teamId' in body) {
    // Placing a player is running the league (divisions, teams), not working the desk: the registrar reads it (Q17).
    const refused = houseLeagueRefusal(ctx, 'run', season);
    if (refused) return refused;
    // Ownership: null clears; anything else must be this season's division / team (plan I01).
    if (body.divisionId != null && !(await divisionInSeason(seasonId, body.divisionId))) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }
    if (body.teamId != null && !(await teamsInSeason(seasonId, [body.teamId]))) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    // A new division is a placement (Part 3, mig 362): a child holding a spot needs one there, a waitlisted child joins
    // the end of the new line, and a spot freed in the old division goes to its first waiting child.
    let promotedId: string | null = null;
    if ('divisionId' in body) {
      const moved = await changeLeagueDivision(ctx!.org.id, seasonId, regId, body.divisionId ?? null, season.autoPromoteWaitlist);
      if ('refusal' in moved) {
        if (moved.refusal === 'full') {
          const { data: div } = await supabaseAdmin.from('league_divisions').select('name').eq('id', body.divisionId).single();
          return NextResponse.json({ error: `${div?.name ?? 'That division'} is full. Add to the waitlist instead.`, code: 'division_full' }, { status: 409 });
        }
        if (moved.refusal === 'no_division') {
          return NextResponse.json({ error: 'A waitlisted registration needs a division' }, { status: 422 });
        }
        return NextResponse.json({ error: 'Division not found' }, { status: 404 });
      }
      promotedId = moved.promotedId;
    }
    if ('teamId' in body) {
      await supabaseAdmin.from('league_registrations')
        .update({ team_id: body.teamId ?? null, updated_at: new Date().toISOString() }).eq('id', regId);
    }
    if (promotedId) emailPromoted(ctx!.org, season, seasonId, promotedId);
    const updated = await fetchReg(regId, seasonId);
    const promoted = promotedId ? await fetchReg(promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }

  // ── status change ────────────────────────────────────────────────────────────
  if (!('status' in body)) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 });
  }
  const statusRefused = houseLeagueRefusal(ctx, 'register', season);
  if (statusRefused) return statusRefused;

  const newStatus = body.status as LeagueRegistrationStatus;
  const VALID: LeagueRegistrationStatus[] = ['pending_review', 'active', 'waitlisted', 'declined', 'withdrawn'];
  if (!VALID.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined;
  const divisionId = reg.divisionId;

  // Helper for email params
  const emailBase = {
    playerFirstName: reg.playerFirstName,
    playerLastName:  reg.playerLastName,
    guardianFirstName: reg.guardianFirstName,
    seasonName:      season.name,
    divisionName:    '', // filled per-branch
    registrationId:  reg.id,
    reference:       reg.signupRef,
    statusPath:      `/${ctx!.org.slug}/league/${season.slug}/status`,
  };

  // The club's face (The public face, warm: S3b): read at most once for this request, worn by every email below. A face that
  // cannot be read is a plainer email, never a missed one.
  let faceRead: ReturnType<typeof systemMailFace> | null = null;
  const faceOnce = () => (faceRead ??= systemMailFace(ctx!.org));
  const familyOf = (face: Awaited<ReturnType<typeof systemMailFace>>, playerFirstName: string) =>
    face ? { face, reason: `${playerFirstName} was signed up for ${season.name}` } : undefined;

  // Resolve division name for emails
  let divisionName = 'your division';
  if (divisionId) {
    const { data: div } = await supabaseAdmin
      .from('league_divisions')
      .select('name')
      .eq('id', divisionId)
      .single();
    if (div) divisionName = div.name;
  }

  // ── → active / pending_review / waitlisted: one locked move (Part 3, mig 362) ───────────────────
  // Accepting a waitlisted child needs a free spot; staff are refused, never silently over-fill.
  if (newStatus === 'active' || newStatus === 'pending_review' || newStatus === 'waitlisted') {
    if (newStatus === 'waitlisted' && !divisionId) {
      return NextResponse.json({ error: 'Cannot waitlist a registration with no division' }, { status: 422 });
    }
    // With the season's auto-promote, a child who held a spot going to the waitlist frees it for the first child waiting.
    const result = await moveLeagueRegistration(ctx!.org.id, seasonId, regId, newStatus, adminNotes ?? null, season.autoPromoteWaitlist);
    if ('refusal' in result) {
      if (result.refusal === 'full') {
        return NextResponse.json({ error: `${divisionName} is full. Add to the waitlist instead.`, code: 'division_full' }, { status: 409 });
      }
      if (result.refusal === 'duplicate') {
        return NextResponse.json({ error: `${reg.playerFirstName} ${reg.playerLastName} already has a registration this season.`, code: 'duplicate' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Cannot waitlist a registration with no division' }, { status: 422 });
    }
    // One email per real change, decided under the lock (a double-click on Accept sends one).
    const changed = result.moved.changed;
    if (result.moved.promotedId) emailPromoted(ctx!.org, season, seasonId, result.moved.promotedId);

    if (changed && newStatus === 'active') {
      void (async () => {
        try {
          const face = await faceOnce();
          await sendTransactionalEmail({
            key: 'league_registration_approved',
            to: reg.guardianEmail,
            vars: {
              guardianFirstName: reg.guardianFirstName,
              playerFirstName:   reg.playerFirstName,
              playerLastName:    reg.playerLastName,
              seasonName:        season.name,
              divisionName,
            },
            // The family reads "accepted" (9b·12); the email now states the price and how to pay.
            defaultSubject: `${reg.playerFirstName} is accepted — ${season.name}`,
            defaultHtml: leagueAdminApprovedHtml({
              ...emailBase, divisionName, face,
              fee: registrationOwes(reg, season), howToPay: season.howToPay, clubName: ctx!.org.name,
            }),
            family: familyOf(face, reg.playerFirstName),
          });
        } catch (e) { console.error('[email] leagueAdminApprovedHtml failed', e); }
      })();
    }

    if (changed && newStatus === 'waitlisted') {
      const newPos = result.moved.waitlistPosition!;
      void (async () => {
        try {
          const face = await faceOnce();
          await sendTransactionalEmail({
            key: 'league_registration_waitlisted',
            to: reg.guardianEmail,
            vars: {
              guardianFirstName: reg.guardianFirstName,
              playerFirstName:   reg.playerFirstName,
              playerLastName:    reg.playerLastName,
              seasonName:        season.name,
              divisionName,
              waitlistPosition:  newPos,
            },
            defaultSubject: `${reg.playerFirstName} is on the waitlist — ${season.name}`,
            defaultHtml: leagueAdminWaitlistedHtml({ ...emailBase, divisionName, waitlistPosition: newPos, face }),
            family: familyOf(face, reg.playerFirstName),
          });
        } catch (e) { console.error('[email] leagueAdminWaitlistedHtml failed', e); }
      })();
    }

    const updated = await fetchReg(regId, seasonId);
    const promoted = result.moved.promotedId ? await fetchReg(result.moved.promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }

  // ── → declined ────────────────────────────────────────────────────────────
  if (newStatus === 'declined') {
    // One locked step: the fee line voided, the registration ended, its waitlist gap closed and — when it held a spot and
    // the season auto-promotes — that spot given to the first child waiting (mig 362).
    const ended = await voidLeagueRegistrationFee(ctx!, seasonId, regId, 'declined', adminNotes, season.autoPromoteWaitlist);
    if ('refused' in ended) return moveRefused(ended.refused);

    void (async () => {
      try {
        const face = await faceOnce();
        await sendTransactionalEmail({
          key: 'league_registration_declined',
          to: reg.guardianEmail,
          vars: {
            guardianFirstName: reg.guardianFirstName,
            playerFirstName:   reg.playerFirstName,
            playerLastName:    reg.playerLastName,
            seasonName:        season.name,
            divisionName,
          },
          defaultSubject: `Registration update — ${season.name}`,
          defaultHtml: leagueRegistrationDeclinedHtml({ ...emailBase, divisionName, face }),
          family: familyOf(face, reg.playerFirstName),
        });
      } catch (e) { console.error('[email] leagueRegistrationDeclinedHtml failed', e); }
    })();

    const updated = await fetchReg(regId, seasonId);
    if (ended.promotedId) emailPromoted(ctx!.org, season, seasonId, ended.promotedId);
    const promoted = ended.promotedId ? await fetchReg(ended.promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }

  // ── → withdrawn (no outbound email for a withdrawal) ──────────────────────
  if (newStatus === 'withdrawn') {
    const ended = await voidLeagueRegistrationFee(ctx!, seasonId, regId, 'withdrawn', adminNotes, season.autoPromoteWaitlist);
    if ('refused' in ended) return moveRefused(ended.refused);
    const updated = await fetchReg(regId, seasonId);
    if (ended.promotedId) emailPromoted(ctx!.org, season, seasonId, ended.promotedId);
    const promoted = ended.promotedId ? await fetchReg(ended.promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }
  return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]' });
