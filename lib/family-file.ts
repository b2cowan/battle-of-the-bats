/**
 * THE FAMILY FILE — what a family's Export holds, said once (Club Tier Stage 5a, E04; Asks 10 + 11, P5).
 *
 * ⚠⚠ THE STATEMENT AND THE CONTENTS ARE ONE LIST. `FAMILY_FILE_SECTIONS` is what the PDF's first page says the file
 * holds, what the structured file's `holds` says, AND the keys of `FamilyFile.sections` the assembler must fill
 * (lib/families-export.ts — its return type is keyed by this list, so a section the statement names cannot be left
 * out without a type error, and `tests/unit/families-stage5a-guard.test.ts` holds the rest). The 2026-10-16 walk found
 * the export calling a page's worth of JSON "everything this organization holds"; a statement that lives apart from
 * the code that fills it drifts the same way.
 *
 * Pure: the PDF is drawn in the browser from the file the route returns (lib/export/pdf.ts `downloadFamilyFile`).
 */
import { FAMILY_FILE_WORDS } from './families-words';
import { formatStoredDate } from './timezone';
import { fmt } from './coach-money-summary';
import { CREDIT_TYPE_LABELS } from './dues-credits';
import { DUES_PAYMENT_METHOD_LABEL, type DuesCreditType, type DuesPaymentMethod } from './types';

export const FAMILY_FILE_SECTIONS = [
  { id: 'contact', title: 'Guardian and contact',
    holds: 'names, every email address used (with dates), phone, the club-email setting and how and when it was recorded' },
  { id: 'children', title: 'Children',
    holds: 'each registration: team or season, birth date, medical notes, emergency contact, any staff note on the registration' },
  { id: 'tryouts', title: 'Tryout applications',
    holds: 'each one, with the consent given on it (when, and the internet address it was sent from)' },
  { id: 'money', title: 'Money',
    holds: 'dues by child, every payment (date, amount, how), a payment the club sent to a coach (when, to whom, and what came of it), credits by kind, reminders sent, house-league fees' },
  { id: 'forms', title: 'Forms and consent',
    holds: 'documents on file and the day each came in; waivers and consents' },
  { id: 'messages', title: 'Messages',
    holds: 'the dates the club emailed this family directly, and who sent each (what was said is not kept)' },
  // Club Tier Stage 5c (Ask 29): the club's notes about the family itself — before Records joined, so the statement follows.
  { id: 'notes', title: 'Notes about the family',
    holds: 'what the club’s staff wrote about the family itself, who wrote each and when' },
  { id: 'merges', title: 'Records joined',
    holds: 'any duplicate record combined with this one, and when' },
] as const;

export type FamilyFileSectionId = typeof FAMILY_FILE_SECTIONS[number]['id'];

/** What the file says it does NOT hold — the coaching records each team keeps. Named so a test can hold the file to it.
 *  ⚖ A coach's pinned note about a player is one (Club Tier Stage 5c, Ask 29 — S5C-03): the coach types it under "never
 *  shown to families", so the file leaves it with the team and says so. */
export const FAMILY_FILE_EXCLUDES = ['evaluations', 'development notes', 'a coach’s pinned note about a player', 'attendance', 'statistics', 'lineups'] as const;

export interface FamilyFileContact {
  name: string;
  phone: string | null;
  addresses: { email: string; current: boolean; firstSeen: string | null; lastSeen: string | null }[];
  clubEmail: 'on' | 'opted_out';
  optOuts: { email: string; at: string; how: string }[];
  /** Other guardians on file for these children — named only; their own details are in their own file. */
  otherGuardians: string[];
}

export interface FamilyFileRegistration {
  kind: 'rep' | 'league';
  where: string;
  season: string;
  status: string;
  since: string | null;
  medicalNotes: string | null;
  emergencyContact: string | null;
  /** The club's notes on the registration, each labelled with who writes it. */
  notes: { label: string; text: string }[];
}

export interface FamilyFileChild { name: string; birthDate: string | null; registrations: FamilyFileRegistration[] }

export interface FamilyFileTryout {
  child: string; where: string; season: string; submittedAt: string | null; status: string;
  consent: { dataCollection: boolean | null; emailComms: boolean | null; eligibility: boolean | null; at: string | null; connection: string | null };
  notes: { label: string; text: string }[];
}

export interface FamilyFileMoney {
  dues: { child: string; season: string; where: string; dues: number; fundraising: number; otherCredits: number; paid: number; handedBack: number; balance: number }[];
  payments: { child: string; date: string; amount: number; method: string | null }[];
  credits: { child: string; date: string | null; kind: string; amount: number; description: string | null }[];
  reminders: { child: string; installment: number; dueDate: string; sentAt: string }[];
  leagueFees: { child: string; season: string; fee: number | null; paid: boolean }[];
  /** A payment the club received and passed to a team's head coach (Stage 5c): when, to whom, what came of it. */
  handoffs: { child: string; sentAt: string; amount: number; receivedDate: string; method: string | null; to: string[]; by: string | null; outcome: 'waiting' | 'recorded' | 'not_received'; answeredBy: string | null; answeredAt: string | null;
    /** What the coach's receipt says, when it differs from what the club passed on. */
    recordedAmount?: number | null }[];
}

export interface FamilyFileForms {
  documents: { child: string; type: string; fileName: string | null; receivedAt: string }[];
  waivers: { child: string; season: string; acceptedAt: string }[];
  consents: { email: string; basis: string; scope: string; startedAt: string; withdrawnAt: string | null }[];
}

export interface FamilyFile {
  organization: string;
  exportedAt: string;
  exportedBy: string | null;
  family: string;
  /** The statement — the same list the sections are keyed by. */
  holds: { title: string; holds: string }[];
  notInThisFile: string;
  sections: {
    contact: FamilyFileContact;
    children: FamilyFileChild[];
    tryouts: FamilyFileTryout[];
    money: FamilyFileMoney;
    forms: FamilyFileForms;
    messages: { at: string; by: string | null }[];
    /** The club's notes about the family (Stage 5c), oldest first, each signed. */
    notes: { at: string; by: string | null; editedAt: string | null; text: string }[];
    merges: { at: string; record: string }[];
  } & Record<FamilyFileSectionId, unknown>;
}

/** The statement half, from the one list. */
export const familyFileStatement = () => ({
  holds: FAMILY_FILE_SECTIONS.map(s => ({ title: s.title, holds: s.holds })),
  notInThisFile: `${FAMILY_FILE_WORDS.notHead} ${FAMILY_FILE_WORDS.notBody}`,
});

// ── The file as lines (the PDF draws these; the structured file is the object itself) ─────────────

const day = (v: string | null | undefined) => (v ? formatStoredDate(v) : '—');
const yesNo = (b: boolean | null) => (b === null ? 'not asked' : b ? 'yes' : 'no');

/** One line of the file, and how far it sits under the line above it (a child's registration, its notes). */
export interface FamilyFileLine { text: string; depth: 0 | 1 | 2 }
const at = (depth: FamilyFileLine['depth']) => (text: string): FamilyFileLine => ({ text, depth });
const top = at(0), under = at(1), deeper = at(2);
const notesLines = (notes: { label: string; text: string }[]) => notes.map(n => `${n.label}: ${n.text}`);

/** A payment the club sent to a coach (Stage 5c), as one Money line: to whom and when, the child, the amount, how and
 *  when it came, who sent it, and what came of it. */
function handoffLine(h: FamilyFileMoney['handoffs'][number]): string {
  const how = h.method ? DUES_PAYMENT_METHOD_LABEL[h.method as DuesPaymentMethod] ?? h.method : null;
  const recorded = h.recordedAmount != null && h.recordedAmount !== h.amount ? `as ${fmt(h.recordedAmount)}` : null;
  const outcome = h.outcome === 'recorded' ? ['recorded', recorded, h.answeredBy ? `by ${h.answeredBy}` : null, day(h.answeredAt)]
    : h.outcome === 'not_received' ? ['not received,', h.answeredBy ? `reported by ${h.answeredBy}` : null, day(h.answeredAt)]
    : ['waiting for the coach'];
  return [
    `Sent to ${h.to.length ? h.to.join(', ') : 'the head coach'} ${day(h.sentAt)}`,
    h.child, fmt(h.amount), how, `received ${day(h.receivedDate)}${h.by ? ` by ${h.by}` : ''}`,
    outcome.filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ');
}

/** One section's lines. A section with nothing on file says so — never an empty heading. Money reads in the product's
 *  one money face (`fmt` — a balance held for the family in brackets, as the team's Player dues shows it), credit kinds
 *  and payment methods by their own labels. */
export function familyFileLines(file: FamilyFile): { id: FamilyFileSectionId; title: string; lines: FamilyFileLine[] }[] {
  const s = file.sections;
  const none = (lines: FamilyFileLine[]) => (lines.length ? lines : [top(FAMILY_FILE_WORDS.none)]);
  const contact = [
    `${s.contact.name}${s.contact.phone ? ` · ${s.contact.phone}` : ' · no phone on file'}`,
    ...s.contact.addresses.map(a => `${a.email} (${a.current ? 'current' : 'former'}) · seen ${day(a.firstSeen)} to ${day(a.lastSeen)}`),
    s.contact.clubEmail === 'on' ? 'Club email: on' : 'Club email: opted out',
    ...s.contact.optOuts.map(o => `Opted out under ${o.email}, ${day(o.at)} (recorded from ${o.how.replace(/_/g, ' ')})`),
    ...(s.contact.otherGuardians.length ? [`Other guardians on file: ${s.contact.otherGuardians.join(', ')}`] : []),
  ].map(top);
  const children = s.children.flatMap(c => [
    top(`${c.name}${c.birthDate ? ` · born ${day(c.birthDate)}` : ''}`),
    ...c.registrations.flatMap(r => [
      under(`${r.where} · ${r.season} · ${r.status}${r.since ? ` · since ${day(r.since)}` : ''}`),
      ...(r.medicalNotes ? [deeper(`Medical notes: ${r.medicalNotes}`)] : []),
      ...(r.emergencyContact ? [deeper(`Emergency contact: ${r.emergencyContact}`)] : []),
      ...notesLines(r.notes).map(deeper),
    ]),
  ]);
  const tryouts = s.tryouts.flatMap(t => [
    top(`${t.child} · ${t.where} ${t.season} · applied ${day(t.submittedAt)} · ${t.status}`),
    under(`Consent: data collection ${yesNo(t.consent.dataCollection)}, club email ${yesNo(t.consent.emailComms)}, eligibility ${yesNo(t.consent.eligibility)}`
      + `${t.consent.at ? ` — given ${day(t.consent.at)}` : ''}${t.consent.connection ? ` from ${t.consent.connection}` : ''}`),
    ...notesLines(t.notes).map(under),
  ]);
  const m = s.money;
  const money = [
    ...m.dues.map(d => [
      `${d.child} · ${d.where} ${d.season}: Dues ${fmt(d.dues)}`,
      d.fundraising ? `Fundraising ${fmt(d.fundraising)}` : '',
      d.otherCredits ? `Other credits ${fmt(d.otherCredits)}` : '',
      `Paid ${fmt(d.paid)}`,
      d.handedBack ? `Handed back ${fmt(d.handedBack)}` : '',
      `Balance ${fmt(d.balance)}`,
    ].filter(Boolean).join(' · ')),
    ...m.payments.map(p => `Payment ${day(p.date)} · ${p.child} · ${fmt(p.amount)}${p.method ? ` · ${DUES_PAYMENT_METHOD_LABEL[p.method as DuesPaymentMethod] ?? p.method}` : ''}`),
    ...m.credits.map(c => `Credit ${day(c.date)} · ${c.child} · ${CREDIT_TYPE_LABELS[c.kind as DuesCreditType] ?? c.kind} · ${fmt(c.amount)}${c.description ? ` · ${c.description}` : ''}`),
    ...m.reminders.map(r => `Reminder sent ${day(r.sentAt)} · ${r.child} · installment ${r.installment}, due ${day(r.dueDate)}`),
    ...m.leagueFees.map(f => `House league · ${f.child} · ${f.season}: ${f.paid ? 'paid' : 'not paid'}${f.fee != null ? ` (fee ${fmt(f.fee)})` : ''}`),
    ...m.handoffs.map(handoffLine),
  ].map(top);
  const forms = [
    ...s.forms.documents.map(d => `${d.type} · ${d.child} · received ${day(d.receivedAt)}${d.fileName ? ` (${d.fileName})` : ''}`),
    ...s.forms.waivers.map(w => `Waiver accepted · ${w.child} · ${w.season} · ${day(w.acceptedAt)}`),
    ...s.forms.consents.map(c => `Consent · ${c.basis.replace(/_/g, ' ')} (${c.scope}) · ${c.email} · from ${day(c.startedAt)}${c.withdrawnAt ? ` · withdrawn ${day(c.withdrawnAt)}` : ''}`),
  ].map(top);
  const messages = s.messages.map(x => top(`${day(x.at)}${x.by ? ` by ${x.by}` : ''}`));
  const notes = s.notes.flatMap(n => [
    // Signed as the screen signs it: a note whose author has left still reads as someone's (FAMILY_NOTE_WORDS.signed).
    top([day(n.at), n.by ?? 'A former member', n.editedAt ? `edited ${day(n.editedAt)}` : null].filter(Boolean).join(' · ')),
    under(n.text),
  ]);
  const merges = s.merges.map(x => top(`${day(x.at)} · ${x.record}`));
  const byId: Record<FamilyFileSectionId, FamilyFileLine[]> = { contact, children, tryouts, money, forms, messages, notes, merges };
  return FAMILY_FILE_SECTIONS.map(sec => ({ id: sec.id, title: sec.title, lines: none(byId[sec.id]) }));
}
