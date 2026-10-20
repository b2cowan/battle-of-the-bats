import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { hasPlanFeature } from '@/lib/plan-features';
import { tournamentToday } from '@/lib/timezone';
import {
  defaultInvoiceDescription, formatInvoiceNumber, invoiceAmount, invoiceFromRow, isRealDate, normalizePaymentDetails,
  type InvoiceArrival,
} from '@/lib/coach-sponsor-invoice';

/**
 * THE SPONSOR INVOICE (Coach Sponsor Invoice, mig 339 — plan docs/projects/active/COACH_SPONSOR_INVOICE_PLAN.md).
 *
 * GET  — what the invoice window opens with: the sponsor's invoice (null before the first download), the team's
 *        "how sponsors pay" details, the number the next new invoice would take, the season's name, and the arrivals.
 * POST — the window's Download: keeps the bill-to and the team's payment details, gives the invoice its number on the
 *        first download, and re-stamps the amount + revised date when the sponsor's amount has moved (A4).
 *
 * ⚠ THE AMOUNT AND THE ARRIVALS ARE NEVER READ FROM THE BODY. Both come from the books, in ONE read here, and both go
 *   back in the answer — so the paid / part paid / unpaid copy can never be printed from a stale screen (/review).
 * ⚠ THE NUMBER IS NEVER REUSED (A2): max+1 within (team, season year), the unique index settling a race by retry;
 *   a deleted sponsorship leaves its row behind (fundraiser_id SET NULL) so max never falls back.
 * ⚖ Always from the team (R1); no tax (R2). Writers only (A5), on plans with PDF documents — the client hides the
 *   door on the same gate, and this is the gate that holds.
 */

type Params = { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> };

const NUMBER_ATTEMPTS = 8;

async function readSponsor(fundraiserId: string, teamId: string, programYearId: string) {
  const { data } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('id, name, kind, pledged_amount')
    .eq('id', fundraiserId)
    .eq('team_id', teamId)
    .eq('program_year_id', programYearId)
    .maybeSingle();
  if (!data || data.kind !== 'sponsor') return null;
  const { data: entries } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('amount_raised, received_date, method, created_at')
    .eq('fundraiser_id', fundraiserId)
    .order('received_date', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  const arrivals: InvoiceArrival[] = (entries ?? []).map(e => ({
    amount: Number(e.amount_raised),
    receivedDate: (e.received_date as string | null) ?? null,
    method: (e.method as string | null) ?? null,
  }));
  const arrived = arrivals.reduce((s, a) => s + a.amount, 0);
  const pledged = data.pledged_amount != null ? Number(data.pledged_amount) : null;
  return { name: data.name as string, pledged, arrivals, amount: invoiceAmount(pledged, arrived) };
}

async function nextSeq(teamId: string, seasonYear: number): Promise<number> {
  const { data } = await supabaseAdmin
    .from('rep_sponsor_invoices')
    .select('seq')
    .eq('team_id', teamId)
    .eq('season_year', seasonYear)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ? Number(data.seq) : 0) + 1;
}

async function readTeamPayment(teamId: string) {
  const { data } = await supabaseAdmin.from('rep_teams').select('sponsor_payment_details').eq('id', teamId).maybeSingle();
  return normalizePaymentDetails(data?.sponsor_payment_details);
}

const failed = () => NextResponse.json({ error: 'The invoice could not be saved. Try again.' }, { status: 500 });

export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team, programYear, capabilities } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const sponsor = await readSponsor(fundraiserId, team.id, programYear.id);
  if (!sponsor) return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });

  const [{ data: row }, teamPayment, seq] = await Promise.all([
    supabaseAdmin.from('rep_sponsor_invoices').select('*').eq('fundraiser_id', fundraiserId).maybeSingle(),
    readTeamPayment(team.id),
    nextSeq(team.id, programYear.year),
  ]);

  return NextResponse.json({
    invoice: row ? invoiceFromRow(row) : null,
    teamPayment,
    teamName: team.name,
    nextNumber: formatInvoiceNumber(programYear.year, seq),
    amount: sponsor.amount,
    hasPledge: sponsor.pledged != null && sponsor.pledged > 0,
    arrivals: sponsor.arrivals,
    seasonName: programYear.name,
    defaultDescription: defaultInvoiceDescription(programYear.name),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/invoice' });

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;
  if (!hasPlanFeature(ctx.org.planId, 'pdf_exports')) {
    return NextResponse.json({ error: 'Sponsor invoices are not included in this plan.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const billToName = text(body.billToName, 160);
  if (!billToName) return NextResponse.json({ error: 'Add the name on the invoice.' }, { status: 400 });
  const description = text(body.description, 240);
  if (!description) return NextResponse.json({ error: 'Add a description of what the sponsor is paying for.' }, { status: 400 });
  if (!isRealDate(body.issuedOn)) return NextResponse.json({ error: 'Add the issue date.' }, { status: 400 });
  const issuedOn = body.issuedOn;
  const dueRaw = body.dueOn ?? null;
  if (dueRaw !== null && dueRaw !== '' && !isRealDate(dueRaw)) {
    return NextResponse.json({ error: 'The due date is not a real date.' }, { status: 400 });
  }
  const dueOn = isRealDate(dueRaw) ? dueRaw : null;
  if (dueOn && dueOn < issuedOn) return NextResponse.json({ error: 'The due date is before the issue date.' }, { status: 400 });
  // The team's details: only when the window sent them as an object (a folded, unchanged section sends nothing). A
  // sent object REPLACES the stored one on purpose — that is how a coach clears a line.
  const sentPayment = body.teamPayment !== undefined;
  if (sentPayment && (typeof body.teamPayment !== 'object' || body.teamPayment === null || Array.isArray(body.teamPayment))) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const sponsor = await readSponsor(fundraiserId, team.id, programYear.id);
  if (!sponsor) return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
  if (sponsor.amount <= 0) {
    return NextResponse.json({ error: 'This sponsor has no amount yet. Add the pledged amount in Edit sponsorship first.' }, { status: 400 });
  }

  const fields = {
    bill_to_name: billToName,
    bill_to_attention: text(body.billToAttention, 160),
    bill_to_email: text(body.billToEmail, 200),
    bill_to_address: text(body.billToAddress, 300),
    description,
    issued_on: issuedOn,
    due_on: dueOn,
  };

  // ── The invoice first: the team's details are written only once it has stood (/review — a refused or failed
  //    invoice must not leave the team's payment details changed behind it). ──
  let row: Record<string, unknown> | null = null;
  let created = false;
  const { data: existing } = await supabaseAdmin
    .from('rep_sponsor_invoices').select('*').eq('fundraiser_id', fundraiserId).maybeSingle();

  if (existing) {
    const moved = Math.abs(Number(existing.amount) - sponsor.amount) > 0.005;
    const { data, error } = await supabaseAdmin
      .from('rep_sponsor_invoices')
      .update({
        ...fields,
        ...(moved ? { amount: sponsor.amount, revised_on: tournamentToday() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) return failed();
    row = data;
  } else {
    // First download: the number. Writers racing for the same max lose to the unique index and take the next one.
    for (let attempt = 0; attempt < NUMBER_ATTEMPTS && !row; attempt++) {
      const seq = await nextSeq(team.id, programYear.year);
      const { data, error } = await supabaseAdmin
        .from('rep_sponsor_invoices')
        .insert({
          ...fields,
          org_id: ctx.org.id,
          team_id: team.id,
          program_year_id: programYear.id,
          fundraiser_id: fundraiserId,
          season_year: programYear.year,
          seq,
          amount: sponsor.amount,
          created_by: ctx.user.id,
        })
        .select('*')
        .single();
      if (!error) { row = data; created = true; break; }
      // The sponsor was deleted between the read and the write.
      if (error.code === '23503') return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
      if (error.code !== '23505') return failed();
      // A unique violation on the SPONSOR (a double press) is answered by the row that won.
      const { data: won } = await supabaseAdmin.from('rep_sponsor_invoices').select('*').eq('fundraiser_id', fundraiserId).maybeSingle();
      if (won) row = won;
    }
  }
  if (!row) return NextResponse.json({ error: 'The invoice number could not be assigned. Try again.' }, { status: 409 });

  let teamPayment = await readTeamPayment(team.id);
  if (sentPayment) {
    teamPayment = normalizePaymentDetails(body.teamPayment);
    const { error: tErr } = await supabaseAdmin.from('rep_teams').update({ sponsor_payment_details: teamPayment }).eq('id', team.id);
    if (tErr) return failed();
  }

  return NextResponse.json(
    { invoice: invoiceFromRow(row), teamPayment, teamName: team.name, arrivals: sponsor.arrivals },
    { status: created ? 201 : 200 },
  );
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/invoice' });
