import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { loadOrgFamilyWorld, householdOf, fullName, personDisplayName, readRepMoney, leagueRegOwes } from './families-read';
import { familyFileStatement, type FamilyFile, type FamilyFileChild } from './family-file';
import { readHandoffs, handoffNamer } from './families-payment';
import { NOTE_COLUMNS } from './families-notes';

/**
 * THE FAMILY FILE'S ASSEMBLER (Club Tier Stage 5a, E04; Ask 10 A — "the administrative file"). Everything the club's
 * family records hold about one family, read from the records Families already reads plus the fields the page never
 * showed: birth dates, medical notes, emergency contacts, the club's notes, tryout applications and their consent,
 * every payment, credits by kind, reminders sent, documents with their dates, how an opt-out was recorded, the message
 * dates, merges. Every line, uncapped.
 *
 * ⚠ The sections are `FAMILY_FILE_SECTIONS` (lib/family-file.ts) — the statement on the file's first page is built
 * from the same list, so the two cannot drift. ⚠ NOT here, by the ruling: coaching records (evaluations, development
 * notes, attendance, statistics, lineups) stay with each team — `tests/unit/families-stage5a-guard.test.ts` refuses a
 * read of their tables in this file. ⚖ Nor the coach's pinned note about a player (`rep_roster_players.notes`, typed under
 * "never shown to families" — Club Tier Stage 5c, Ask 29, S5C-03): never selected here, and the statement names it.
 * Stage 5c adds the club's notes about the family (`family_notes`) and the payments it passed to a coach.
 *
 * The household rule is the family page's (`householdOf`): the file is about THIS person — other
 * guardians are named, their own contact details are in their own file. Org-scoped like every Families read.
 */
export async function buildFamilyFile(orgId: string, orgName: string, personId: string, exportedById: string): Promise<FamilyFile | null> {
  // An export is an ACTION, made to answer a family: it attaches first, so a child whose guardian email changed since the
  // last worklist visit is never exported under the old guardian (/review 2026-10-17).
  const world = await loadOrgFamilyWorld(orgId, { attach: true });
  const p: any = world.personById.get(personId);
  if (!p) return null;

  const household = householdOf(world, p);
  const roster = household.roster;
  const league = household.league;
  const myAddresses = world.addresses.filter((a: any) => a.person_id === p.id)
    .sort((a: any, b: any) => Number(b.is_current) - Number(a.is_current) || String(a.first_seen_at).localeCompare(String(b.first_seen_at)));
  const addressSet = new Set(myAddresses.map((a: any) => a.email_normalized));
  const rosterIds = roster.map(r => r.id);

  const [details, leagueDetails, tryouts, docs, templates, money, messages, merges, familyNotes, handoffs] = await Promise.all([
    fetchAllIn<any>(rosterIds, (chunk, from, to) => supabaseAdmin.from('rep_roster_players')
      .select('id, player_date_of_birth, medical_notes, emergency_contact_name, emergency_contact_phone, admin_notes, status')
      .eq('org_id', orgId).in('id', chunk).order('id').range(from, to)),
    fetchAllIn<any>(league.map(r => r.id), (chunk, from, to) => supabaseAdmin.from('league_registrations')
      .select('id, player_date_of_birth, player_notes, admin_notes, status, registered_at, waiver_accepted_at')
      .eq('org_id', orgId).in('id', chunk).order('id').range(from, to)),
    fetchAll<any>((from, to) => supabaseAdmin.from('rep_tryout_registrations')
      .select('id, player_first_name, player_last_name, player_date_of_birth, player_notes, admin_notes, status, submitted_at, consent_data_collection, consent_email_comms, consent_eligibility, consent_at, consent_ip, rep_teams(name), rep_program_years(name, year)')
      .eq('org_id', orgId).eq('person_id', p.id).order('id').range(from, to)),
    fetchAllIn<any>(rosterIds, (chunk, from, to) => supabaseAdmin.from('rep_player_documents')
      .select('id, player_id, document_type, file_name, template_id, created_at')
      .eq('org_id', orgId).in('player_id', chunk).order('id').range(from, to)),
    fetchAll<any>((from, to) => supabaseAdmin.from('rep_document_templates')
      .select('id, name').eq('org_id', orgId).order('id').range(from, to)),
    readRepMoney(orgId, roster),
    fetchAll<any>((from, to) => supabaseAdmin.from('family_messages')
      .select('id, sent_at, sent_by').eq('org_id', orgId).eq('person_id', p.id).order('sent_at').order('id').range(from, to)),
    fetchAll<any>((from, to) => supabaseAdmin.from('org_person_merges')
      .select('id, merged_at, merged_snapshot').eq('org_id', orgId).eq('kept_person_id', p.id).order('merged_at').order('id').range(from, to)),
    fetchAll<any>((from, to) => supabaseAdmin.from('family_notes')
      .select(NOTE_COLUMNS).eq('org_id', orgId).eq('person_id', p.id).order('created_at').order('id').range(from, to)),
    readHandoffs(orgId, p.id),
  ]);
  // The exporter and every sender, named in one lookup.
  // The exporter, every sender, every note's author and everyone the hand-offs name — one lookup.
  const nameOf = await handoffNamer(orgId, handoffs, [exportedById, ...messages.map(m => m.sent_by), ...familyNotes.map(n => n.created_by)]);
  const detailById = new Map(details.map(d => [d.id, d]));
  const leagueById = new Map(leagueDetails.map(d => [d.id, d]));
  const templateName = new Map(templates.map(t => [t.id, t.name]));
  const rosterById = new Map(roster.map(r => [r.id, r]));
  const childOf = (playerId: string) => { const r = rosterById.get(playerId); return r ? fullName(r.player_first_name, r.player_last_name) : 'A child'; };
  const note = (label: string, text: string | null | undefined) => (text && text.trim() ? [{ label, text: text.trim() }] : []);
  const seasonOf = (r: any) => r.rep_program_years?.name ?? String(r.rep_program_years?.year ?? '');

  // ── Children: each child once, every registration under them (E08: confirmed continuity joins rep seasons) ──
  const children = new Map<string, FamilyFileChild>();
  for (const r of roster) {
    const d = detailById.get(r.id) ?? {};
    const key = world.childKeyOf(r.id);
    const c: FamilyFileChild = children.get(key) ?? { name: fullName(r.player_first_name, r.player_last_name), birthDate: d.player_date_of_birth ?? null, registrations: [] };
    c.birthDate = c.birthDate ?? d.player_date_of_birth ?? null;
    c.registrations.push({
      kind: 'rep' as const, where: r.rep_teams?.name ?? 'Rep team', season: seasonOf(r),
      status: d.status ?? r.status ?? 'active', since: r.created_at ?? null,
      medicalNotes: d.medical_notes ?? null,
      emergencyContact: [d.emergency_contact_name, d.emergency_contact_phone].filter(Boolean).join(' · ') || null,
      // The club's staff note only — the coach's pinned note stays with the team (Stage 5c, Ask 29).
      notes: note('Staff note', d.admin_notes),
    });
    children.set(key, c);
  }
  for (const r of league) {
    const d = leagueById.get(r.id) ?? {};
    children.set(`league:${r.id}`, {
      name: fullName(r.player_first_name, r.player_last_name), birthDate: d.player_date_of_birth ?? null,
      registrations: [{
        kind: 'league' as const, where: r.league_divisions?.name ?? 'House league', season: r.league_seasons?.name ?? 'House league',
        status: d.status ?? r.status, since: d.registered_at ?? r.registered_at ?? null,
        medicalNotes: null, emergencyContact: null,
        notes: [...note('Notes from the family', d.player_notes), ...note('Staff note', d.admin_notes)],
      }],
    });
  }

  // ── Money: the team's own figures per season, every payment, credits by kind, reminders, league fees ──
  const dues = roster.map(r => {
    const f = money.figures.get(r.id);
    return f ? {
      child: fullName(r.player_first_name, r.player_last_name), season: seasonOf(r),
      where: r.rep_teams?.name ?? 'Rep team',
      dues: f.ladder.dues, fundraising: f.ladder.fundraising, otherCredits: f.ladder.otherCredits,
      paid: f.ladder.paid, handedBack: f.ladder.handedBack, balance: f.balance,
    } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x && [x.dues, x.fundraising, x.otherCredits, x.paid, x.handedBack, x.balance].some(v => v !== 0));

  // Every reminder stamp the money read already carries, one line each.
  const reminders = money.installments
    .flatMap(i => i.reminders.map(sentAt => ({ child: childOf(i.playerId), installment: i.installmentNumber, dueDate: i.dueDate, sentAt })))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  const optOuts = world.optouts.filter((o: any) => addressSet.has(o.email))
    .map((o: any) => ({ email: o.email, at: o.opted_out_at, how: o.source }));
  const consents = world.consents.filter((c: any) => addressSet.has(c.guardian_email))
    .map((c: any) => ({ email: c.guardian_email, basis: c.basis, scope: c.scope, startedAt: c.basis_started_at, withdrawnAt: c.withdrawn_at ?? null }));

  const statement = familyFileStatement();
  return {
    organization: orgName,
    exportedAt: new Date().toISOString(),
    exportedBy: nameOf(exportedById),
    family: personDisplayName(p),
    holds: statement.holds,
    notInThisFile: statement.notInThisFile,
    sections: {
      contact: {
        name: personDisplayName(p),
        phone: p.phone ?? null,
        addresses: myAddresses.map((a: any) => ({ email: a.email_normalized, current: !!a.is_current, firstSeen: a.first_seen_at ?? null, lastSeen: a.last_seen_at ?? null })),
        clubEmail: optOuts.length ? 'opted_out' : 'on',
        optOuts,
        otherGuardians: household.guardians.slice(1).map(g => g.name),
      },
      children: [...children.values()].sort((a, b) => a.name.localeCompare(b.name)),
      tryouts: tryouts.map(t => ({
        child: fullName(t.player_first_name, t.player_last_name),
        where: t.rep_teams?.name ?? 'Rep team', season: seasonOf(t),
        submittedAt: t.submitted_at ?? null, status: t.status ?? 'submitted',
        consent: {
          dataCollection: t.consent_data_collection ?? null, emailComms: t.consent_email_comms ?? null,
          eligibility: t.consent_eligibility ?? null, at: t.consent_at ?? null, connection: t.consent_ip ?? null,
        },
        notes: [...note('Notes from the family', t.player_notes), ...note('Staff note', t.admin_notes)],
      })),
      money: {
        dues,
        payments: money.payments.map(pay => ({ child: childOf(pay.playerId), date: pay.receivedDate, amount: pay.amount, method: pay.method }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        credits: money.credits.map(c => ({ child: childOf(c.playerId), date: c.creditDate, kind: c.kind, amount: c.amount, description: c.description }))
          .sort((a, b) => String(a.date).localeCompare(String(b.date))),
        reminders,
        leagueFees: league.map(r => ({
          child: fullName(r.player_first_name, r.player_last_name), season: r.league_seasons?.name ?? 'House league',
          fee: leagueRegOwes(r),
          paid: r.registration_fee_paid === true,
        })),
        handoffs: [...handoffs].reverse().map(h => ({
          child: h.player_name, sentAt: h.sent_at, amount: h.amount, receivedDate: h.received_date, method: h.method,
          to: h.sent_to.map(id => nameOf(id)).filter((n): n is string => !!n),
          by: h.sent_by ? nameOf(h.sent_by) : null,
          outcome: h.state === 'sent' ? 'waiting' as const : h.state,
          answeredBy: h.resolved_by ? nameOf(h.resolved_by) : null, answeredAt: h.resolved_at, recordedAmount: h.recorded_amount,
        })),
      },
      forms: {
        documents: docs.map(d => ({ child: childOf(d.player_id), type: templateName.get(d.template_id) ?? d.document_type, fileName: d.file_name ?? null, receivedAt: d.created_at }))
          .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
        waivers: league.flatMap(r => {
          const at = leagueById.get(r.id)?.waiver_accepted_at;
          return at ? [{ child: fullName(r.player_first_name, r.player_last_name), season: r.league_seasons?.name ?? 'House league', acceptedAt: at }] : [];
        }),
        consents,
      },
      messages: messages.map(m => ({ at: m.sent_at, by: nameOf(m.sent_by) })),
      notes: familyNotes.map(n => ({ at: n.created_at, by: n.created_by ? nameOf(n.created_by) : null, editedAt: n.edited_at ?? null, text: n.body })),
      merges: merges.map(m => {
        const snap = (m.merged_snapshot ?? {}) as Record<string, string | null>;
        const who = [snap.first_name, snap.last_name].filter(Boolean).join(' ');
        return { at: m.merged_at, record: who ? `${who} (${snap.email_normalized ?? ''})` : String(snap.email_normalized ?? 'A record') };
      }),
    },
  };
}
