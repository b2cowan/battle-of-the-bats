'use client';
/**
 * A FAMILY, OPENED OVER THE LIST (Club Tier Stage 5b — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P2; Asks 5, 6, 13, 15,
 * 17). Monday's job is a list ("Owes money · 5") worked one family at a time, so a family is the admin kit's wide record
 * window over the list it came from (the 3d allocation window's): its eyebrow names the list and the place in it,
 * Previous · Next in its foot walk that list (absent at either end, and when it was opened from a link with no list), and
 * its `address` puts `/families/{personId}` in the URL bar while it is open.
 *
 * It READS (Ask 15): nothing on a family is typed here — a contact detail is changed where it is typed, and Contact names
 * where ("Named on") — so it has no pencil. Its sections, top to bottom:
 *   the top line — "Guardian of 3 children", Message this family (5a's send window, raised over the record — the kit's
 *                  form-over-record layer; absent for an opted-out family or one whose three are spent, the reason where
 *                  the door was) and Export (5a's one button: the PDF first, then the structured file). On a phone,
 *                  Message and the Export icon at the top, 44 px (Ask 13).
 *   the band     — Dues · Paid · Balance, the joined band (10-08): the Children table's lines summed. A rep child's line
 *                  is read through the money module so it matches the team's Money hub (E03); this season's house-league
 *                  fees join the total (owner 2026-10-18, §329 W3 — the band counts what "Owes money" counts). Balance is
 *                  what the family OWES — each line's balance above zero, the list's figure — never a credit on one
 *                  team's book netted against another child's dues.
 *   Children     — each child once (E08) with Dues · Paid · Balance in the coach's ladder words (the event lines under a
 *                  child only when not zero); a house-league child's fee in the same three columns — paid in full or not
 *                  at all, since a registration records no part payment.
 *   Contact      — read lines: every address (a former one with its date), phone, Club email, Last messaged … by …,
 *                  where the family is named. The six explanatory footnotes went to Help (Ask 6); the one fact a reader
 *                  cannot infer — an opt-out under a former address — keeps its line.
 *   Forms and consent — a table with the one chip, then Consent.
 *   History      — five lines and "Show all N".
 * Club Tier Stage 5c (P1–P3, owner Asks 26–29 + 32, 2026-10-19) adds three things and moves nothing above them:
 *   Record a payment — the top line's third act, between Message and Export, the same white outline (each opens a window;
 *                  the record has no lime). Absent when nothing is owed or the member can do none of its lines; on a phone
 *                  "Record payment", 44 px, the three in one row. It opens RecordPaymentWindow, raised over the record.
 *   the chips    — an amber "Sent to coach" beside a rep child while a payment the club passed on waits for the coach; a
 *                  red "Not received" if the coach says so (a status in a row is a chip; amounts and dates are in History).
 *   Notes        — after Children: a signed, dated list (FamilyNotes.tsx). The record still keeps no pencil.
 */
import { useCallback, useState } from 'react';
import { DollarSign, Mail } from 'lucide-react';
import KitDialog, { type KitStep } from '../KitDialog';
import { ClubRow, ClubRowFrame, ClubRowList, LoadFailed, NoticePill, RepChip, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { money, moneyFetch, moneyKit } from '../money/MoneyKit';
import MessageFamilyWindow from './MessageFamilyWindow';
import RecordPaymentWindow from './RecordPaymentWindow';
import { AddNoteWindow, NoteWindow, NotesSection } from './FamilyNotes';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import ExportMenu from '@/components/admin/ExportMenu';
import LoadingState from '@/components/shared/LoadingState';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatStoredDate } from '@/lib/timezone';
import { joinWithAnd } from '@/lib/utils';
import { FAMILY_LINE_WORDS } from '@/lib/house-league-money-words';
import {
  FAMILY_FILE_WORDS as FW, FAMILY_MESSAGE_WORDS as MW, FAMILY_PAGE_WORDS as PW, FAMILY_PAYMENT_WORDS as PayW,
  FAMILY_RECORD_WORDS as W,
} from '@/lib/families-words';
import { planOpens, type FamilyRecordPayload } from '@/lib/families-payment-plan';
import type { FamilyFile } from '@/lib/family-file';
import type { FamilyChildLine } from '@/lib/families-read';
import { fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, downloadFamilyFile } from '@/lib/export/pdf';
import fam from './Families.module.css';

const cents = (n: number) => money(n / 100);
const HISTORY_SHOWN = 5;

export default function FamilyRecordWindow({ q, personId, listName, list, address, onStep, onClose }: {
  /** `orgSlug=…` */
  q: string;
  personId: string;
  /** The list it was opened from ("Owes money"), or null when it was opened from a link with no list. */
  listName: string | null;
  list: readonly { personId: string; name: string }[] | null;
  /** The record's place in the URL bar. */
  address: (personId: string) => string;
  onStep: (personId: string) => void;
  onClose: () => void;
}) {
  const { currentOrg } = useOrg();
  const isPhone = useIsPhone();
  const [read, setRead] = useState<FamilyRecordPayload | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [paying, setPaying] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  // org-slug-ok: `q` IS the org ("orgSlug=…", passed by the Families tab — every fetch in this window carries it).
  const url = `/api/admin/families/${encodeURIComponent(personId)}?${q}`;

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<FamilyRecordPayload>(url).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed({ notFound: r?.status === 404 }); return; }
    setFailed(null);
    setRead(r.data);
  }, [url, beginRead]);
  useDeferredLoad(true, load);

  // Previous · Next through the list it came from: absent at either end, and with no list.
  const at = list ? list.findIndex(f => f.personId === personId) : -1;
  const stepTo = (f: { personId: string; name: string } | undefined): KitStep | null =>
    (f ? { name: f.name, onStep: () => onStep(f.personId) } : null);
  const steps = list && at >= 0
    ? { prev: stepTo(list[at - 1]), next: stepTo(list[at + 1]), position: `${at + 1} of ${list.length}`, positionWide: `${at + 1} of ${list.length} in ${listName}`, noun: W.noun }
    : undefined;
  const eyebrow = listName && list && at >= 0 ? `${listName} · ${at + 1} of ${list.length}` : W.eyebrowNoList;

  /** The family file, as the house PDF (drawn here, from the route's file) or the structured file (downloaded). */
  const exportPdf = useCallback(async () => {
    setSaid(null);
    try {
      const [res, settings] = await Promise.all([
        // org-slug-ok: `q` is "orgSlug=…".
        fetch(`/api/admin/families/${encodeURIComponent(personId)}/export?${q}&format=pdf`),
        // org-slug-ok: `q` is "orgSlug=…".
        fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`),
      ]);
      if (!res.ok) { setSaid(FW.failed); return; }
      const { file } = (await res.json()) as { file: FamilyFile };
      await downloadFamilyFile(`family-file-${file.family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`, { file, settings: settings ?? DEFAULT_PDF_SETTINGS });
    } catch {
      setSaid(FW.failed);
    }
  }, [personId, q]);
  const exportJson = useCallback(async () => {
    setSaid(null);
    try {
      // org-slug-ok: `q` is "orgSlug=…".
      const res = await fetch(`/api/admin/families/${encodeURIComponent(personId)}/export?${q}&format=json`);
      if (!res.ok) { setSaid(FW.failed); return; }
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'family-file.json';
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = href; a.download = name; a.click();
      URL.revokeObjectURL(href);
    } catch {
      setSaid(FW.failed);
    }
  }, [personId, q]);

  const shell = { kind: 'form' as const, size: 'wide' as const, eyebrow, onClose, steps, address: address(personId) };

  // Only the FIRST read's failure takes the window over; a re-read that fails (after a send) keeps what it shows.
  if (failed && !read) {
    return (
      <KitDialog {...shell} title={W.eyebrowNoList}>
        {failed.notFound ? <LoadFailed title={W.notFound} /> : <LoadFailed title={W.loadFailed} onRetry={() => void load()} />}
      </KitDialog>
    );
  }
  if (!read) {
    return (
      <KitDialog {...shell} title={list?.[at]?.name ?? W.eyebrowNoList}>
        <div className={fam.loading}><LoadingState inline label="Loading this family…" /></div>
      </KitDialog>
    );
  }

  const { person, addresses, money: m, guardians, contact, message, forms, consents, history } = read;
  const doorReason = message.reachable === 0 ? MW.optedOutReason : message.capped ? MW.capReason(message.nextAt) : null;
  const current = addresses.find(a => a.isCurrent);
  const former = addresses.filter(a => !a.isCurrent);
  const otherGuardians = guardians.filter(g => g.personId !== person.id);
  const liveConsents = consents.filter(c => !c.withdrawnAt);
  const showForms = forms.length > 0 || liveConsents.length > 0;
  const hasMoney = m.children.length > 0 || m.leagueFeeCount > 0;
  const canPay = planOpens(read.payment);
  const openNote = noteOpen ? read.notes.find(n => n.id === noteOpen) ?? null : null;

  const exportMenu = (
    <ExportMenu
      formats={['pdf']}
      onExportPDF={exportPdf}
      pdfLabel={FW.pdf}
      planId={currentOrg?.planId}
      holds={{ title: FW.menuHolds }}
      document={{ onExportJSON: exportJson, jsonLabel: FW.structured, jsonHint: FW.structuredHint }}
    />
  );

  return (
    <>
      <KitDialog
        {...shell}
        title={person.name}
        status={said ? <NoticePill inline key={said} message={said} onDone={() => setSaid(null)} /> : undefined}
      >
        <div className={fam.top}>
          {!isPhone && <span className={fam.identity}>{W.guardianOf(read.childCount)}</span>}
          {doorReason
            ? <span className={fam.topReason}>{doorReason}</span>
            : (
              <button type="button" className={`btn btn-outline ${fam.topMessage}`} aria-haspopup="dialog"
                onClick={() => { setSaid(null); setMessaging(true); }}>
                <Mail size={14} aria-hidden />{isPhone ? W.messageShort : MW.door}
              </button>
            )}
          {canPay && (
            <button type="button" className={`btn btn-outline ${fam.topPay}`} aria-haspopup="dialog"
              onClick={() => { setSaid(null); setPaying(true); }}>
              <DollarSign size={14} aria-hidden />{isPhone ? PayW.doorShort : PayW.door}
            </button>
          )}
          {exportMenu}
        </div>

        {hasMoney && (
          <div className={moneyKit.windowBand}>
            <MoneySummaryBand
              ariaLabel={`${person.name}: dues`}
              tiles={[
                { key: 'dues', label: W.dues, figure: cents(m.duesCents), caption: isPhone ? undefined : W.duesCaption(m.repChildCount, m.leagueFeeCount, m.repYears) },
                { key: 'paid', label: W.paid, figure: cents(m.paidCents), caption: isPhone ? undefined : W.paymentsCaption(m.paymentCount, m.leagueFeesPaid) },
                { key: 'balance', label: W.balance, figure: cents(m.owedCents), caption: m.owingChildren.length ? joinWithAnd(m.owingChildren) : W.nobodyOwes },
              ]}
            />
          </div>
        )}

        <h3 className={fam.h}>{W.children}</h3>
        {read.childLines.length === 0
          ? <p className={repKit.dim}>{W.historyNone}</p>
          : isPhone ? <ChildCards lines={read.childLines} chips={read.handoffChips} /> : <ChildTable lines={read.childLines} chips={read.handoffChips} />}

        <NotesSection notes={read.notes} onAdd={() => { setSaid(null); setAddingNote(true); }} onOpen={id => { setSaid(null); setNoteOpen(id); }} />

        <h3 className={fam.h}>{W.contact}</h3>
        <dl className={fam.read}>
          <dt>{W.email}</dt><dd>{current?.email ?? person.email}</dd>
          {former.map(a => (
            <FormerLine key={a.email} email={a.email} until={a.lastSeenAt} />
          ))}
          <dt>{W.phone}</dt><dd className={person.phone ? undefined : fam.quiet}>{person.phone ?? W.notOnFile}</dd>
          <dt>{W.clubEmail}</dt>
          <dd>
            {contact.optedOut ? W.optedOut : W.on}
            {contact.optedOut && contact.optedOutVia && contact.optedOutVia !== person.email && <span className={fam.ladder}>{W.optedOutVia(contact.optedOutVia)}</span>}
          </dd>
          {otherGuardians.map(g => (
            <GuardianLine key={g.personId} name={g.name} email={g.email} provenance={g.provenance} />
          ))}
          <dt>{MW.lastMessaged}</dt>
          <dd className={message.lastMessaged ? undefined : fam.quiet}>{message.lastMessaged ? MW.lastMessagedValue(message.lastMessaged.at, message.lastMessaged.by) : MW.neverMessaged}</dd>
          {read.namedOn.length > 0 && <><dt>{W.namedOnLabel}</dt><dd>{W.namedOn(read.namedOn)}</dd></>}
        </dl>

        {showForms && (
          <>
            <h3 className={fam.h}>{W.forms}</h3>
            {forms.length > 0 && (isPhone ? (
              <ClubRowFrame><ClubRowList inset label={W.forms}>
                {forms.map((f, i) => (
                  <ClubRow key={`${f.childName}-${f.templateName}-${i}`} title={f.templateName} caption={f.childName}
                    trail={<FormChip status={f.status} />} />
                ))}
              </ClubRowList></ClubRowFrame>
            ) : (
              <div className={repKit.tableFrame}>
                <table className={repKit.table}>
                  <thead><tr><th scope="col" style={{ width: '28%' }}>{W.colChild}</th><th scope="col">{W.colForm}</th><th scope="col" style={{ width: '22%' }}>{W.colState}</th></tr></thead>
                  <tbody>
                    {forms.map((f, i) => (
                      <tr key={`${f.childName}-${f.templateName}-${i}`}>
                        <td>{f.childName}</td>
                        <td>{f.templateName}</td>
                        <td><FormChip status={f.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <dl className={`${fam.read}${forms.length > 0 ? ` ${fam.readAfter}` : ''}`}>
              <dt>{W.consent}</dt>
              <dd className={liveConsents.length ? undefined : fam.quiet}>
                {liveConsents.length === 0 ? W.consentNone : liveConsents.map((c, i) => <span key={i} className={fam.childLine}>{W.consentLine(c.basis, c.startedAt)}</span>)}
              </dd>
            </dl>
          </>
        )}

        <h3 className={fam.h}>{W.history}</h3>
        {history.length === 0 ? <p className={repKit.dim}>{W.historyNone}</p> : (
          <>
            <dl className={fam.hist}>
              {(allHistory ? history : history.slice(0, HISTORY_SHOWN)).map((h, i) => (
                <HistoryLine key={i} at={h.at} what={h.what} />
              ))}
            </dl>
            {history.length > HISTORY_SHOWN && (
              <button type="button" className={repKit.inlineLink} onClick={() => setAllHistory(v => !v)}>
                {allHistory ? W.showFewer : W.showAll(history.length)}
              </button>
            )}
          </>
        )}
      </KitDialog>

      {messaging && (
        <MessageFamilyWindow
          q={q}
          personId={personId}
          familyName={person.name}
          raised
          onClose={() => setMessaging(false)}
          onSent={text => { setMessaging(false); setSaid(text); void load(); }}
        />
      )}
      {paying && (
        <RecordPaymentWindow
          q={q}
          personId={personId}
          familyName={person.name}
          plan={read.payment}
          onClose={() => setPaying(false)}
          onDone={text => { setPaying(false); setSaid(text); void load(); }}
          onChanged={() => void load()}
        />
      )}
      {addingNote && (
        <AddNoteWindow
          q={q}
          personId={personId}
          familyName={person.name}
          onClose={() => setAddingNote(false)}
          onSaved={() => { setAddingNote(false); void load(); }}
        />
      )}
      {openNote && (
        <NoteWindow
          key={openNote.id}
          q={q}
          personId={personId}
          familyName={person.name}
          note={openNote}
          onClose={() => setNoteOpen(null)}
          onChanged={text => { if (text) setSaid(text); void load(); }}
        />
      )}
    </>
  );
}

function FormChip({ status }: { status: 'on_file' | 'missing' }) {
  return <RepChip tone={status === 'on_file' ? 'good' : 'bad'}>{status === 'on_file' ? W.onFile : W.missing}</RepChip>;
}

function FormerLine({ email, until }: { email: string; until: string }) {
  return <><dt>{W.formerEmail}</dt><dd>{W.formerUntil(email, until)}</dd></>;
}
function GuardianLine({ name, email, provenance }: { name: string; email: string; provenance: string }) {
  return <><dt>{W.otherGuardian}</dt><dd>{name}<span className={fam.ladder}>{email ? `${email} · ${provenance}` : provenance}</span></dd></>;
}
function HistoryLine({ at, what }: { at: string; what: string }) {
  return <><dt>{formatStoredDate(at)}</dt><dd>{what}</dd></>;
}

/** The event terms under a child — only when not zero (the coach's dues ladder, 09-07). */
function LadderLines({ line }: { line: FamilyChildLine }) {
  const mm = line.money;
  if (!mm) return null;
  const terms = [
    mm.fundraisingCents !== 0 ? W.ladderLine(PW.fundraising, cents(mm.fundraisingCents)) : null,
    mm.otherCreditsCents !== 0 ? W.ladderLine(PW.otherCredits, cents(mm.otherCreditsCents)) : null,
    mm.handedBackCents !== 0 ? W.ladderLine(PW.handedBack, cents(mm.handedBackCents)) : null,
  ].filter(Boolean) as string[];
  return terms.length ? <span className={fam.ladder}>{terms.join(' · ')}</span> : null;
}

const whereOf = (l: FamilyChildLine) => {
  const where = l.source === 'league' ? `${l.where} · ${W.houseLeague}` : `${l.where}${l.year ? ` · ${l.year}` : ''}`;
  return l.current ? where : W.notBack(where);
};

/** A line's three figures — a rep child's from the team's book, a house-league child's from its fee (owner 2026-10-18). */
const figuresOf = (l: FamilyChildLine) =>
  l.money ? { dues: l.money.duesCents, paid: l.money.paidCents, balance: l.money.balanceCents }
    : l.league?.feeCents != null ? { dues: l.league.feeCents, paid: l.league.paidCents, balance: l.league.balanceCents }
      : null;

/** The hand-off's chip beside a rep child (Stage 5c): amber while the coach has it, red when they say it never came. */
function HandoffChip({ state }: { state: 'sent' | 'not_received' | undefined }) {
  if (!state) return null;
  return (
    <span className={fam.inlineChip}>
      <RepChip tone={state === 'sent' ? 'warn' : 'bad'}>{state === 'sent' ? PayW.chipSent : PayW.chipNotReceived}</RepChip>
    </span>
  );
}

type Chips = FamilyRecordPayload['handoffChips'];

function ChildTable({ lines, chips }: { lines: readonly FamilyChildLine[]; chips: Chips }) {
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col" style={{ width: '28%' }}>{W.colChild}</th>
            <th scope="col">{W.colWhere}</th>
            <th scope="col" className={repKit.num} style={{ width: '13%' }}>{W.colDues}</th>
            <th scope="col" className={repKit.num} style={{ width: '13%' }}>{W.colPaid}</th>
            <th scope="col" className={repKit.num} style={{ width: '14%' }}>{W.colBalance}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => {
            const f = figuresOf(l);
            return (
              <tr key={l.key}>
                <td><span className={fam.nameRow}><span className={fam.childName}>{l.childName}</span><HandoffChip state={chips[l.key]} /></span><LadderLines line={l} /></td>
                <td className={l.current ? undefined : repKit.dim}>
                  {whereOf(l)}
                  {/* 9b-2 (copy §13): a house-league fee is the price fixed when the family signed up. */}
                  {l.league?.feeCents != null && l.league.fixedOn && (
                    <span className={fam.ladder}>{FAMILY_LINE_WORDS.fixed(formatStoredDate(l.league.fixedOn))}</span>
                  )}
                </td>
                {f ? (
                  <>
                    <td className={repKit.num}>{cents(f.dues)}</td>
                    <td className={repKit.num}>{cents(f.paid)}</td>
                    <td className={repKit.num}>
                      {cents(f.balance)}
                      {/* The pay link's place (Stage 12 fills it): greyed, a tooltip says how to record it by hand. */}
                      {l.league && f.balance > 0 && (
                        <span className={fam.ladder}>
                          <button type="button" className="btn btn-outline" disabled title={FAMILY_LINE_WORDS.ghostTip} aria-label={`${FAMILY_LINE_WORDS.ghost}: ${FAMILY_LINE_WORDS.ghostTip}`}>
                            {FAMILY_LINE_WORDS.ghost}
                          </button>
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <td className={`${repKit.num} ${repKit.dim}`} colSpan={3}>{!l.current ? '' : l.league ? W.noFee : W.noDues}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChildCards({ lines, chips }: { lines: readonly FamilyChildLine[]; chips: Chips }) {
  return (
    <ClubRowFrame><ClubRowList inset label={W.children}>
      {lines.map(l => {
        const f = figuresOf(l);
        return (
          <ClubRow
            key={l.key}
            title={(
              <span className={fam.cardTitle}>
                <span>{l.childName}<HandoffChip state={chips[l.key]} /></span>
                {f && <span className={fam.cardFigure}>{cents(f.balance)}</span>}
              </span>
            )}
            caption={(
              <>
                {whereOf(l)}
                {f && ` · ${W.colDues} ${cents(f.dues)} · ${W.colPaid} ${cents(f.paid)}`}
                <LadderLines line={l} />
              </>
            )}
          />
        );
      })}
    </ClubRowList></ClubRowFrame>
  );
}
