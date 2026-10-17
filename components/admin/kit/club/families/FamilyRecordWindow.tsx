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
 *   the band     — Rep dues · Paid · Balance, the joined band (10-08), read through the money module so it matches the
 *                  team's Money hub (E03). Balance is what the family OWES — each child's balance above zero, the list's
 *                  figure — never a credit on one team's book netted against another child's dues. A house-league fee is
 *                  never in it.
 *   Children     — each child once (E08) with Dues · Paid · Balance in the coach's ladder words (the event lines under a
 *                  child only when not zero); a house-league child's fee and its chip on its row, never summed.
 *   Contact      — read lines: every address (a former one with its date), phone, Club email, Last messaged … by …,
 *                  where the family is named. The six explanatory footnotes went to Help (Ask 6); the one fact a reader
 *                  cannot infer — an opt-out under a former address — keeps its line.
 *   Forms and consent — a table with the one chip, then Consent.
 *   History      — five lines and "Show all N".
 */
import { useCallback, useState } from 'react';
import { Mail } from 'lucide-react';
import KitDialog, { type KitStep } from '../KitDialog';
import { ClubRow, ClubRowFrame, ClubRowList, LoadFailed, NoticePill, RepChip, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { money, moneyFetch, moneyKit } from '../money/MoneyKit';
import MessageFamilyWindow from './MessageFamilyWindow';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import ExportMenu from '@/components/admin/ExportMenu';
import LoadingState from '@/components/shared/LoadingState';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatStoredDate } from '@/lib/timezone';
import { joinWithAnd } from '@/lib/utils';
import {
  FAMILY_FILE_WORDS as FW, FAMILY_MESSAGE_WORDS as MW, FAMILY_PAGE_WORDS as PW, FAMILY_RECORD_WORDS as W,
} from '@/lib/families-words';
import type { FamilyFile } from '@/lib/family-file';
import type { FamilyChildLine, FamilyPagePayload } from '@/lib/families-read';
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
  const [read, setRead] = useState<FamilyPagePayload | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  // org-slug-ok: `q` IS the org ("orgSlug=…", passed by the Families tab — every fetch in this window carries it).
  const url = `/api/admin/families/${encodeURIComponent(personId)}?${q}`;

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<FamilyPagePayload>(url).catch(() => null);
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

  const shell = { kind: 'form' as const, wide: true, eyebrow, onClose, steps, address: address(personId) };

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
  const hasRepMoney = m.children.length > 0;

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
          {exportMenu}
        </div>

        {hasRepMoney && (
          <div className={moneyKit.windowBand}>
            <MoneySummaryBand
              ariaLabel={`${person.name}: rep dues`}
              tiles={[
                { key: 'dues', label: W.repDues, figure: cents(m.repDuesCents), caption: isPhone ? undefined : W.duesCaption(m.repChildCount, m.repYears) },
                { key: 'paid', label: W.paid, figure: cents(m.repPaidCents), caption: isPhone ? undefined : W.paymentsCaption(m.paymentCount) },
                { key: 'balance', label: W.balance, figure: cents(m.repOwedCents), caption: m.owingChildren.length ? joinWithAnd(m.owingChildren) : W.nobodyOwes },
              ]}
            />
          </div>
        )}

        <h3 className={fam.h}>{W.children}</h3>
        {read.childLines.length === 0
          ? <p className={repKit.dim}>{W.historyNone}</p>
          : isPhone ? <ChildCards lines={read.childLines} /> : <ChildTable lines={read.childLines} />}

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

function FeeCell({ league }: { league: NonNullable<FamilyChildLine['league']> }) {
  return (
    <>
      {league.feeCents != null ? W.registrationFee(cents(league.feeCents)) : W.registrationNoFee}{' '}
      <RepChip tone={league.paid ? 'good' : 'bad'}>{league.paid ? W.feePaid : W.feeNotPaid}</RepChip>
    </>
  );
}

function ChildTable({ lines }: { lines: readonly FamilyChildLine[] }) {
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col" style={{ width: '24%' }}>{W.colChild}</th>
            <th scope="col">{W.colWhere}</th>
            <th scope="col" className={repKit.num} style={{ width: '13%' }}>{W.colDues}</th>
            <th scope="col" className={repKit.num} style={{ width: '13%' }}>{W.colPaid}</th>
            <th scope="col" className={repKit.num} style={{ width: '14%' }}>{W.colBalance}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.key}>
              <td><span className={fam.childName}>{l.childName}</span><LadderLines line={l} /></td>
              <td className={l.current ? undefined : repKit.dim}>{whereOf(l)}</td>
              {l.money ? (
                <>
                  <td className={repKit.num}>{cents(l.money.duesCents)}</td>
                  <td className={repKit.num}>{cents(l.money.paidCents)}</td>
                  <td className={repKit.num}>{cents(l.money.balanceCents)}</td>
                </>
              ) : l.league ? (
                <td className={repKit.num} colSpan={3}><FeeCell league={l.league} /></td>
              ) : (
                <td className={`${repKit.num} ${repKit.dim}`} colSpan={3}>{l.current ? W.noDues : ''}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChildCards({ lines }: { lines: readonly FamilyChildLine[] }) {
  return (
    <ClubRowFrame><ClubRowList inset label={W.children}>
      {lines.map(l => (
        <ClubRow
          key={l.key}
          title={(
            <span className={fam.cardTitle}>
              <span>{l.childName}</span>
              {l.money ? <span className={fam.cardFigure}>{cents(l.money.balanceCents)}</span>
                : l.league ? <RepChip tone={l.league.paid ? 'good' : 'bad'}>{l.league.paid ? W.feePaid : W.feeNotPaid}</RepChip> : null}
            </span>
          )}
          caption={(
            <>
              {whereOf(l)}
              {l.money && ` · ${W.colDues} ${cents(l.money.duesCents)} · ${W.colPaid} ${cents(l.money.paidCents)}`}
              {l.league?.feeCents != null && ` · ${PW.leagueFeeOf(cents(l.league.feeCents))}`}
              <LadderLines line={l} />
            </>
          )}
        />
      ))}
    </ClubRowList></ClubRowFrame>
  );
}
