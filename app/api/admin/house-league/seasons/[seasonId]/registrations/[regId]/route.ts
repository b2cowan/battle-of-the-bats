import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { canMarkLeagueFeePaid, endLeagueRegistration, writeLeagueMoney, type EndMoney, type LeagueMoneyMove, type LeagueMoneyRefusal } from '@/lib/league-fee-paid';
import { MONEY_REFUSAL } from '@/lib/house-league-money-words';
import { moveRefused } from '@/lib/club-money-route';
import { getLeagueSeasonById } from '@/lib/db';
import { changeLeagueDivision, moveLeagueRegistration } from '@/lib/league-registration-place';
import { leaguePrice, priceFromBody, registrationOwes } from '@/lib/league-price';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason, teamsInSeason } from '@/lib/league-season-scope';
import {
  leagueAdminApprovedHtml,
  leagueAdminWaitlistedHtml,
  leagueWaitlistPromotedHtml,
  leagueRegistrationDeclinedHtml,
  leagueSpotReleasedHtml,
  type EndedMoneyLine,
} from '@/lib/email';
import { loadRegistrationMoneyLines } from '@/lib/league-money-read';
import { formatLeagueMoney, receivedOf } from '@/lib/league-money';
import { possessive } from '@/lib/utils';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { systemMailFace } from '@/lib/club-email-context';
import type { LeagueRegistrationStatus } from '@/lib/types';
import { orgDayKey, tournamentToday } from '@/lib/timezone';
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
    acceptedAt:          row.accepted_at ?? null,
    endedAt:             row.ended_at ?? null,
    spotReleased:        row.spot_released ?? false,
    endMoney:            row.end_money ?? null,
    endMoneyReason:      row.end_money_reason ?? null,
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

/** A division's price for a child who signed up on `registeredAt` (the club's day): the early bird still applies. */
async function divisionPriceFor(
  divisionId: string,
  season: { registrationFee: number | null; earlyBirdUntil: string | null },
  registeredAt: string,
): Promise<number | null> {
  const { data: div, error } = await supabaseAdmin.from('league_divisions').select('price, early_price').eq('id', divisionId).maybeSingle();
  if (error) throw error;
  if (!div) return null;
  const price = leaguePrice(
    { price: div.price != null ? Number(div.price) : null, earlyPrice: div.early_price != null ? Number(div.early_price) : null },
    season, orgDayKey(registeredAt),
  );
  return price?.amount ?? null;
}

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** A money press as the screens send it. Null when it is not one of the shapes (nothing is guessed). */
function readMoneyMove(raw: unknown): LeagueMoneyMove | null {
  const m = (raw ?? {}) as Record<string, unknown>;
  const method = m.method == null || m.method === '' ? null : String(m.method);
  if (m.kind === 'receive' && typeof m.day === 'string') return { kind: 'receive', day: m.day, method };
  if (m.kind === 'undo') return { kind: 'undo', entryId: typeof m.entryId === 'string' ? m.entryId : null };
  if (m.kind === 'price') {
    const price = priceFromBody(m.price);
    if (!price || 'error' in price || price.value == null) return null;
    return { kind: 'price', price: price.value, reason: text(m.reason, 200) ?? '', day: typeof m.day === 'string' ? m.day : null, method };
  }
  return null;
}

/** What happened to the money on an ending, as the window sends it. Undefined when not sent; null when malformed. */
function readEndMoney(raw: unknown): EndMoney | null | undefined {
  if (raw == null) return undefined;
  const m = raw as Record<string, unknown>;
  if (m.answer === 'refunded' && typeof m.day === 'string') {
    return { answer: 'refunded', day: m.day, method: m.method == null || m.method === '' ? null : String(m.method), reason: text(m.reason, 200) };
  }
  if (m.answer === 'kept') return { answer: 'kept', reason: text(m.reason, 200) ?? '' };
  return null;
}

/** A refusal from the money writer or the ending, in the copy's words (§16). */
function moneyRefusal(
  refusal: LeagueMoneyRefusal,
  reg: { playerFirstName: string; playerLastName: string; feeAmount: number | null },
  season: { registrationFee: number | null },
  ending = false,
): Response {
  const name = `${reg.playerFirstName} ${reg.playerLastName}`;
  const amount = formatLeagueMoney(registrationOwes(reg, season) ?? 0);
  const words: Record<LeagueMoneyRefusal, [number, string]> = {
    ended: [409, MONEY_REFUSAL.ended(name)],
    not_accepted: [409, MONEY_REFUSAL.notAccepted(name)],
    already_received: [409, (registrationOwes(reg, season) ?? 0) > 0 ? MONEY_REFUSAL.alreadyReceived(name) : MONEY_REFUSAL.free(name)],
    amount: [400, MONEY_REFUSAL.amount],
    over: [409, MONEY_REFUSAL.changed],
    changed: [409, MONEY_REFUSAL.changed],
    nothing_received: [409, MONEY_REFUSAL.nothingToUndo(name)],
    refunded: [409, MONEY_REFUSAL.refundedUndo],
    same: [400, MONEY_REFUSAL.priceSame],
    reason: [400, ending ? MONEY_REFUSAL.keptReason(amount) : MONEY_REFUSAL.priceReason],
    money: [409, MONEY_REFUSAL.money(amount)],
    date: [400, MONEY_REFUSAL.date],
    future: [400, ending ? MONEY_REFUSAL.futureRefund : MONEY_REFUSAL.futurePayment],
    method: [400, MONEY_REFUSAL.method],
    before_payment: [400, MONEY_REFUSAL.beforePayment],
  };
  const [status, error] = words[refusal];
  return NextResponse.json({ error, code: refusal }, { status });
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

  // ── money ────────────────────────────────────────────────────────────────────
  // ONE write, shared with the family record's Record a payment (Club Tier Stage 5c Part A; rebuilt 9b-2 — lib/league-fee-paid.ts):
  // received (a day and how), undo, a corrected price. The fiscal year's lock and the line live there. It stays open on a
  // finished season (Q16). `feePaid` is the old tick's shape (true = the whole balance received today; false = undo).
  // An ending's money answer rides with its status (below); only a status-less body is a money press.
  if (('money' in body || 'feePaid' in body) && !('status' in body)) {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    const move: LeagueMoneyMove | null = 'money' in body
      ? readMoneyMove(body.money)
      : body.feePaid ? { kind: 'receive', day: tournamentToday(), method: null } : { kind: 'undo' };
    if (!move) return NextResponse.json({ error: MONEY_REFUSAL.changed, code: 'bad_money' }, { status: 400 });
    const wrote = await writeLeagueMoney(ctx!, { seasonId, regId }, move);
    if ('refused' in wrote) return moveRefused(wrote.refused);
    if ('refusal' in wrote) return moneyRefusal(wrote.refusal, reg, season);
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
    let keptPrice = false;
    if ('divisionId' in body) {
      // "Use {division}'s price" (9b-2): the new division's price for the day this child signed up, worked out here, never
      // taken from the request. A child who has paid keeps theirs (the database refuses the change and says so).
      const price = body.reprice === true && body.divisionId ? await divisionPriceFor(body.divisionId, season, reg.registeredAt) : null;
      const moved = await changeLeagueDivision(ctx!.org.id, seasonId, regId, body.divisionId ?? null, season.autoPromoteWaitlist, price, ctx!.user.id);
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
      keptPrice = moved.keptPrice;
    }
    if ('teamId' in body) {
      await supabaseAdmin.from('league_registrations')
        .update({ team_id: body.teamId ?? null, updated_at: new Date().toISOString() }).eq('id', regId);
    }
    if (promotedId) emailPromoted(ctx!.org, season, seasonId, promotedId);
    const updated = await fetchReg(regId, seasonId);
    const promoted = promotedId ? await fetchReg(promotedId, seasonId) : null;
    return NextResponse.json({ registration: updated, ...(promoted ? { promoted } : {}), ...(keptPrice ? { keptPrice } : {}) });
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

  // ── → declined / withdrawn / the spot released ──────────────────────────────────
  // One locked step (mig 368): when money was received the window's answer is required — refunded (its own line out,
  // beside the payment) or kept with a reason — then the registration ends, its waitlist gap closes and, when it held a spot
  // and the season auto-promotes, that spot goes to the first child waiting. Nothing is voided (Q6). A refund is money,
  // so it needs the fee right as well as the desk's.
  if (newStatus === 'declined' || newStatus === 'withdrawn') {
    const released = newStatus === 'withdrawn' && body.released === true;
    const money = readEndMoney(body.money);
    if (money === null) return NextResponse.json({ error: MONEY_REFUSAL.changed, code: 'bad_money' }, { status: 400 });
    if (money?.answer === 'refunded' && !canMarkLeagueFeePaid(ctx!)) return forbidden();
    const familyNote = newStatus === 'withdrawn' && !released ? null : text(body.familyNote, 2000);
    const ended = await endLeagueRegistration(ctx!, { seasonId, regId }, {
      status: newStatus, notes: adminNotes ?? null, promote: season.autoPromoteWaitlist, released, money: money ?? null,
    });
    if ('refused' in ended) return moveRefused(ended.refused);
    if ('refusal' in ended) return moneyRefusal(ended.refusal, reg, season, true);

    // What the family is told about their money: the refund line just written, or the fee the club keeps.
    let mailMoney: EndedMoneyLine | null = null;
    if (money) {
      const lines = (await loadRegistrationMoneyLines([regId])).get(regId) ?? [];
      const refund = ended.refundEntryId ? lines.find(l => l.id === ended.refundEntryId) : null;
      if (refund) mailMoney = { answer: 'refunded', amount: refund.amount, day: refund.day, method: refund.method };
      else if (money.answer === 'kept' && receivedOf(lines) > 0) mailMoney = { answer: 'kept', amount: receivedOf(lines), reason: money.reason };
    }

    if (newStatus === 'declined' || released) {
      void (async () => {
        try {
          const face = await faceOnce();
          if (released) {
            await sendTransactionalEmail({
              key: 'league_spot_released',
              to: reg.guardianEmail,
              vars: {
                guardianFirstName: reg.guardianFirstName,
                playerFirstName:   reg.playerFirstName,
                playerLastName:    reg.playerLastName,
                seasonName:        season.name,
                divisionName,
              },
              defaultSubject: `${possessive(reg.playerFirstName)} spot was released — ${season.name}`,
              defaultHtml: leagueSpotReleasedHtml({
                ...emailBase, divisionName, face, fee: registrationOwes(reg, season), note: familyNote, money: mailMoney,
              }),
              family: familyOf(face, reg.playerFirstName),
            });
            return;
          }
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
            defaultHtml: leagueRegistrationDeclinedHtml({ ...emailBase, divisionName, face, note: familyNote, money: mailMoney }),
            family: familyOf(face, reg.playerFirstName),
          });
        } catch (e) { console.error('[email] house-league ending email failed', e); }
      })();
    }

    const updated = await fetchReg(regId, seasonId);
    if (ended.promotedId) emailPromoted(ctx!.org, season, seasonId, ended.promotedId);
    const promoted = ended.promotedId ? await fetchReg(ended.promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }
  return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]' });
