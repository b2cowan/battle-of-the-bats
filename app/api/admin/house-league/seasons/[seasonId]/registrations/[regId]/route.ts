import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getLeagueSeasonById,
  updateRegistrationStatus,
  promoteFromWaitlist,
  getWaitlistForDivision,
  createLeagueRegistrationFeeEntry,
  updateEntry,
  voidEntry,
  getLedgerEntries,
  getLeagueSeasonLedger,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  leagueAdminApprovedHtml,
  leagueAdminWaitlistedHtml,
  leagueWaitlistPromotedHtml,
  leagueRegistrationDeclinedHtml,
  sendEmail,
} from '@/lib/email';
import type { LeagueRegistrationStatus } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

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

async function compactWaitlist(divisionId: string, afterPosition: number) {
  const { data: remaining } = await supabaseAdmin
    .from('league_registrations')
    .select('id, waitlist_position')
    .eq('division_id', divisionId)
    .eq('status', 'waitlisted')
    .gt('waitlist_position', afterPosition)
    .order('waitlist_position', { ascending: true });

  if (!remaining?.length) return;

  await Promise.all(
    remaining.map((r: any) =>
      supabaseAdmin
        .from('league_registrations')
        .update({ waitlist_position: r.waitlist_position - 1, updated_at: new Date().toISOString() })
        .eq('id', r.id),
    ),
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seasonId: string; regId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { seasonId, regId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const reg = await fetchReg(regId, seasonId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  return NextResponse.json({ registration: reg });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ seasonId: string; regId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { seasonId, regId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const reg = await fetchReg(regId, seasonId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  const body = await req.json();
  const role = ctx!.role;
  const isAdminOrOwner = role === 'owner' || role === 'league_admin';
  const canManageRegs  = isAdminOrOwner || role === 'league_registrar';

  // ── feePaid ──────────────────────────────────────────────────────────────────
  if ('feePaid' in body) {
    if (!canManageRegs) return forbidden();
    const paid = Boolean(body.feePaid);
    await supabaseAdmin
      .from('league_registrations')
      .update({ registration_fee_paid: paid, updated_at: new Date().toISOString() })
      .eq('id', regId);

    // Sync ledger entry if one is linked
    if (reg.feeEntryId) {
      const ledger = await getLeagueSeasonLedger(ctx!.org.id, seasonId);
      if (ledger) {
        await updateEntry(reg.feeEntryId, ledger.id, { status: paid ? 'posted' : 'pending' });
      }
    } else if (paid && season.registrationFee) {
      // No entry yet — create one as posted immediately (manual/retroactive)
      const playerName = `${reg.playerFirstName} ${reg.playerLastName}`;
      await createLeagueRegistrationFeeEntry(
        ctx!.org.id, seasonId, season.name, regId, playerName,
        season.registrationFee, 'posted', ctx!.user.id,
      );
    }

    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── adminNotes only ──────────────────────────────────────────────────────────
  if ('adminNotes' in body && !('status' in body) && !('divisionId' in body) && !('teamId' in body)) {
    if (!canManageRegs) return forbidden();
    await supabaseAdmin
      .from('league_registrations')
      .update({ admin_notes: body.adminNotes ?? null, updated_at: new Date().toISOString() })
      .eq('id', regId);
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── divisionId / teamId reassignment ────────────────────────────────────────
  if ('divisionId' in body || 'teamId' in body) {
    if (!isAdminOrOwner) return forbidden();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('divisionId' in body) patch.division_id = body.divisionId ?? null;
    if ('teamId'     in body) patch.team_id     = body.teamId     ?? null;
    await supabaseAdmin.from('league_registrations').update(patch).eq('id', regId);
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── status change ────────────────────────────────────────────────────────────
  if (!('status' in body)) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 });
  }
  if (!canManageRegs) return forbidden();

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
  };

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

  // ── → active (approve / promote from waitlist) ────────────────────────────
  if (newStatus === 'active') {
    const oldWaitlistPos = reg.waitlistPosition;
    await updateRegistrationStatus(regId, 'active', adminNotes);

    // Compact waitlist if this was a waitlisted entry
    if (reg.status === 'waitlisted' && divisionId && oldWaitlistPos !== null) {
      await compactWaitlist(divisionId, oldWaitlistPos);
    }

    // Auto-generate pending fee entry if configured and not already present
    if (season.autoGenerateFees && season.registrationFee && !reg.feeEntryId) {
      const playerName = `${reg.playerFirstName} ${reg.playerLastName}`;
      void createLeagueRegistrationFeeEntry(
        ctx!.org.id, seasonId, season.name, regId, playerName,
        season.registrationFee, 'pending', ctx!.user.id,
      ).catch(e => console.error('[ledger] fee entry creation failed', e));
    }

    void (async () => {
      try {
        await sendEmail(
          reg.guardianEmail,
          `Registration approved — ${season.name}`,
          leagueAdminApprovedHtml({ ...emailBase, divisionName }),
        );
      } catch (e) { console.error('[email] leagueAdminApprovedHtml failed', e); }
    })();

    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── → waitlisted ──────────────────────────────────────────────────────────
  if (newStatus === 'waitlisted') {
    if (!divisionId) {
      return NextResponse.json({ error: 'Cannot waitlist a registration with no division' }, { status: 422 });
    }
    const { count } = await supabaseAdmin
      .from('league_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('division_id', divisionId)
      .eq('status', 'waitlisted');

    const newPos = (count ?? 0) + 1;
    await supabaseAdmin
      .from('league_registrations')
      .update({
        status:           'waitlisted',
        waitlist_position: newPos,
        admin_notes:      adminNotes ?? reg.adminNotes,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', regId);

    void (async () => {
      try {
        await sendEmail(
          reg.guardianEmail,
          `Waitlist update — ${season.name}`,
          leagueAdminWaitlistedHtml({ ...emailBase, divisionName, waitlistPosition: newPos }),
        );
      } catch (e) { console.error('[email] leagueAdminWaitlistedHtml failed', e); }
    })();

    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── → declined ────────────────────────────────────────────────────────────
  if (newStatus === 'declined') {
    await updateRegistrationStatus(regId, 'declined', adminNotes);

    void (async () => {
      try {
        await sendEmail(
          reg.guardianEmail,
          `Registration update — ${season.name}`,
          leagueRegistrationDeclinedHtml({ ...emailBase, divisionName }),
        );
      } catch (e) { console.error('[email] leagueRegistrationDeclinedHtml failed', e); }
    })();

    const updated = await fetchReg(regId, seasonId);

    // Auto-promote
    if (season.autoPromoteWaitlist && divisionId) {
      const waitlist = await getWaitlistForDivision(divisionId);
      if (waitlist.length > 0) {
        const next = waitlist[0];
        const oldPos = next.waitlistPosition;
        await promoteFromWaitlist(next.id);
        if (oldPos !== null) await compactWaitlist(divisionId, oldPos);

        const promotedDivisionName = divisionName;
        void (async () => {
          try {
            await sendEmail(
              next.guardianEmail,
              `You're off the waitlist — ${season.name}`,
              leagueWaitlistPromotedHtml({
                playerFirstName:  next.playerFirstName,
                playerLastName:   next.playerLastName,
                guardianFirstName: next.guardianFirstName,
                seasonName:       season.name,
                divisionName:     promotedDivisionName,
                registrationId:   next.id,
              }),
            );
          } catch (e) { console.error('[email] leagueWaitlistPromotedHtml failed', e); }
        })();

        const promoted = await fetchReg(next.id, seasonId);
        return NextResponse.json({ registration: updated, promoted });
      }
    }

    return NextResponse.json({ registration: updated });
  }

  // ── → withdrawn ───────────────────────────────────────────────────────────
  if (newStatus === 'withdrawn') {
    await updateRegistrationStatus(regId, 'withdrawn', adminNotes);
    const updated = await fetchReg(regId, seasonId);

    // Auto-promote (same logic as declined, no outbound email for withdrawal)
    if (season.autoPromoteWaitlist && divisionId) {
      const waitlist = await getWaitlistForDivision(divisionId);
      if (waitlist.length > 0) {
        const next = waitlist[0];
        const oldPos = next.waitlistPosition;
        await promoteFromWaitlist(next.id);
        if (oldPos !== null) await compactWaitlist(divisionId, oldPos);

        void (async () => {
          try {
            await sendEmail(
              next.guardianEmail,
              `You're off the waitlist — ${season.name}`,
              leagueWaitlistPromotedHtml({
                playerFirstName:  next.playerFirstName,
                playerLastName:   next.playerLastName,
                guardianFirstName: next.guardianFirstName,
                seasonName:       season.name,
                divisionName,
                registrationId:   next.id,
              }),
            );
          } catch (e) { console.error('[email] leagueWaitlistPromotedHtml failed', e); }
        })();

        const promoted = await fetchReg(next.id, seasonId);
        return NextResponse.json({ registration: updated, promoted });
      }
    }

    return NextResponse.json({ registration: updated });
  }

  // ── → pending_review ─────────────────────────────────────────────────────
  await updateRegistrationStatus(regId, 'pending_review', adminNotes);
  const updated = await fetchReg(regId, seasonId);
  return NextResponse.json({ registration: updated });
}
