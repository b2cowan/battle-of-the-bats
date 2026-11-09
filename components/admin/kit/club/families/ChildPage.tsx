'use client';
/**
 * A CHILD'S PAGE (Club Tier Stage 14 S5, drawings tab 5 — the club admin's; owner 2026-11-05 "agree as recommended").
 *
 * The one place every season of a child meets. Opened from a household's Children line, from a name on any rep team's
 * roster (the live roster and a past season's record), and from Families' "No family on file" list. It READS — the
 * club admin has no add-player door (Ask 8). Its one action is SPLIT RECORDS (Stage 14 S6), shown when the child has two or more
 * seasons — it parts seasons typed as one child, or undoes a join (nothing was ever deleted):
 *   the header — the child's name; Born {date} and where the child plays now; back to the household it was opened from
 *                (`?from=`), else to Families. In the admin's header since Phase 3 (A8): Born as quiet words, the season a chip.
 *   Seasons    — every season, newest first, rep and house league together; each season's fees read from its own book.
 *   Documents  — per team, the coach's rule and count ("2 to sign"), never pooled; on a phone one sentence per team.
 *                Last signed (owner 2026-11-05, drawing 58oV67ka48y4yCFPqWneya): ONE value a row, the newest copy by date
 *                across the team and house league; "+N earlier" opens every copy in a window (desk only — A3).
 *   Health and emergency — the child's one value, and "Still right for the {season}?" with Confirm (it clears every
 *                coach's question — S5 call C).
 *   Parents    — each opens their household.
 */
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TabPageHeader } from '../PlaceFrame';
import { useHandNamedPlace } from '@/components/admin/AdminBarPlace';
import KitDialog from '../KitDialog';
import SplitRecordsWindow from './SplitRecordsWindow';
import {
  Callout, ClubRow, ClubRowList, ClubSection, LoadFailed, NoticePill, PageLoading, RepChip, repKit,
  useDeferredLoad, useLatestRead,
} from '../RepKit';
import { moneyFetch } from '../money/MoneyKit';
import { useOrg } from '@/lib/org-context';
import { CHILD_SPLIT_WORDS as SW } from '@/lib/child-join-words';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import {
  CHILD_PAGE_WORDS as W, SEASON_STATUS_LABEL, SEASON_STATUS_TONE, copyName, documentCopies, documentsSentence, seasonRowPhoneLine, seasonRowPhoneTitle,
  type DocumentCopy,
} from '@/lib/child-page-words';
import { formatStoredDate } from '@/lib/timezone';
import type { ChildPageDocuments, ChildPagePayload } from '@/lib/child-page';
import fam from './Families.module.css';
import css from './ChildPage.module.css';

export default function ChildPage({ orgSlug, childId }: { orgSlug: string; childId: string }) {
  const { loading: orgLoading } = useOrg();
  const isPhone = useIsPhone();
  const search = useSearchParams();
  const from = search.get('from');
  const base = `/${orgSlug}/admin`;
  const parentHref = (personId: string) => `${base}/families/${encodeURIComponent(personId)}`;
  const contactOf = (p: { email: string | null; phone: string | null }) => [p.email, p.phone].filter(Boolean).join(' · ');
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const url = `/api/admin/families/children/${encodeURIComponent(childId)}?${q}`;

  const [read, setRead] = useState<ChildPagePayload | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  /** The window behind "+N earlier": one document's every copy. */
  const [copiesOf, setCopiesOf] = useState<CopiesOpen | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<ChildPagePayload>(url).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed({ notFound: r?.status === 404 }); return; }
    setFailed(null);
    setRead(r.data);
  }, [url, beginRead]);
  useDeferredLoad(!orgLoading, load);

  usePageTitle(read ? `${read.child.name} · ${W.families}` : W.families);

  async function confirmHealth() {
    if (!read?.health.ask) return;
    const seasonName = read.health.ask.seasonName;
    setConfirming(true); setSaid(null); setConfirmError(null);
    try {
      const res = await fetch(`/api/admin/families/children/${encodeURIComponent(childId)}/health?${q}`, { method: 'POST' });
      // 409: a coach confirmed it meanwhile — the question is gone either way; the re-read shows that.
      if (!res.ok && res.status !== 409) throw new Error();
      setSaid(W.confirmed(seasonName));
      await load();
    } catch {
      setConfirmError(W.confirmFailed);
    } finally {
      setConfirming(false);
    }
  }

  // Back to the household it was opened from (when that person is one of the child's parents), else to Families.
  const household = from && read ? read.parents.find(p => p.personId === from) ?? null : null;
  const familiesHref = `${base}/families`;
  const householdHref = household?.personId ? `${base}/families/${encodeURIComponent(household.personId)}` : null;
  const backTo = householdHref ? { href: householdHref, label: household!.name } : { href: familiesHref, label: W.families };
  // ⚖ Admin header Phase 3 (A8, round 5 Q4): the header names the child, back to the household it was opened from (the
  // `?from=` the paper's way back read) or to Families; "Born {date}" as quiet words beside the name on desktop and on the
  // phone's line, the season the child plays in now as the chip. The address said "Child" and "← Families" at once.
  useHandNamedPlace(read ? {
    title: read.child.name,
    back: backTo,
    detail: read.child.dateOfBirth ? W.born(read.child.dateOfBirth) : undefined,
    chip: read.currentChip ? <RepChip tone="good">{read.currentChip}</RepChip> : undefined,
  } : null);
  const header = (
    <TabPageHeader
      backTo={backTo}
      title={read?.child.name ?? W.families}
      actions={read && read.seasons.length >= 2 ? (
        <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={() => setSplitting(true)}>{SW.open}</button>
      ) : undefined}
      titleChips={read ? (
        <>
          {read.child.dateOfBirth && <RepChip>{W.born(read.child.dateOfBirth)}</RepChip>}
          {read.currentChip && <RepChip tone="good">{read.currentChip}</RepChip>}
        </>
      ) : null}
    />
  );

  if (failed && !read) {
    return (
      <div className={repKit.page}>
        {header}
        {failed.notFound ? <LoadFailed title={W.notFound} /> : <LoadFailed title={W.loadFailed} onRetry={() => void load()} />}
      </div>
    );
  }
  if (!read) return <PageLoading header={header} label={W.loading} />;

  const { seasons, documents, health, parents } = read;
  const toSign = documents.reduce((s, d) => s + d.toSign, 0);
  const hasHealth = !!(health.medicalNotes || health.emergencyName || health.emergencyPhone);
  const leagueCopies = documentCopies([], read.leagueOnlyWaivers);

  return (
    <div className={repKit.page}>
      {header}
      {said && <NoticePill message={said} onDone={() => setSaid(null)} />}
      {splitting && (
        <SplitRecordsWindow orgSlug={orgSlug} read={read} onClose={() => setSplitting(false)}
          onSplit={message => { setSplitting(false); setSaid(message); void load(); }} />
      )}

      <ClubSection title={W.seasons} list={isPhone}>
        {seasons.length === 0 ? <p className={repKit.dim}>{W.noSeasons}</p> : isPhone ? (
          <ClubRowList inset label={W.seasons}>
            {seasons.map(r => (
              <ClubRow key={r.key} title={seasonRowPhoneTitle(r)} caption={seasonRowPhoneLine(r)}
                trail={r.status !== 'finished' ? <RepChip tone={SEASON_STATUS_TONE[r.status]}>{SEASON_STATUS_LABEL[r.status]}</RepChip> : undefined} />
            ))}
          </ClubRowList>
        ) : (
          <div className={repKit.tableFrame}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">{W.colSeason}</th>
                  <th scope="col">{W.colWhere}</th>
                  <th scope="col" className={repKit.num}>{W.colNumber}</th>
                  <th scope="col">{W.colStatus}</th>
                  <th scope="col" className={repKit.num}>{W.colFees}</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map(r => (
                  <tr key={r.key}>
                    <td>
                      <span className={fam.childName}>{r.seasonName}</span>
                      {r.kind === 'league' && <span className={fam.ladder}>{W.houseLeague}</span>}
                    </td>
                    <td>{r.where}</td>
                    <td className={`${repKit.num}${r.number ? '' : ` ${repKit.dim}`}`}>{r.number ?? '—'}</td>
                    <td><RepChip tone={SEASON_STATUS_TONE[r.status]}>{SEASON_STATUS_LABEL[r.status]}</RepChip></td>
                    <td className={repKit.num}>{r.fees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClubSection>

      <div className={css.pair}>
        <ClubSection title={W.documents} meta={toSign > 0 ? <RepChip tone="warn">{W.toSign(toSign)}</RepChip> : undefined}>
          {documents.length === 0 && read.leagueOnlyWaivers.length === 0 ? <p className={repKit.dim}>{W.noDocuments}</p> : (
            <div className={css.blocks}>
              {documents.map(d => (
                <DocumentsBlock key={d.teamId} block={d} isPhone={isPhone} labelled={documents.length > 1 || d.seasonName === null}
                  onEarlier={(title, copies) => setCopiesOf({ title, eyebrow: W.copiesEyebrow(read.child.name, d.teamName), copies })} />
              ))}
              {leagueCopies.length > 0 && (
                <p className={css.sentence}>
                  {`${W.houseLeague}: ${W.leagueOnlyWaiver(copyName(leagueCopies[0]))}`}
                  {!isPhone && leagueCopies.length > 1 && (
                    <EarlierLink doc={W.waiver} n={leagueCopies.length - 1}
                      onOpen={() => setCopiesOf({ title: W.waiver, eyebrow: W.copiesEyebrow(read.child.name, W.houseLeague), copies: leagueCopies })} />
                  )}
                </p>
              )}
            </div>
          )}
        </ClubSection>

        <ClubSection title={W.health}>
          <dl className={fam.read}>
            <dt>{W.medicalNote}</dt>
            <dd className={health.medicalNotes ? undefined : fam.quiet}>{health.medicalNotes ?? W.nothingOnFile}</dd>
            <dt>{W.emergencyContact}</dt>
            <dd className={health.emergencyName || health.emergencyPhone ? undefined : fam.quiet}>
              {[health.emergencyName, health.emergencyPhone].filter(Boolean).join(' · ') || W.nothingOnFile}
            </dd>
          </dl>
          {health.ask && hasHealth && (
            <div className={css.ask}>
              <Callout tone="warn" role="note" flush
                action={(
                  <button type="button" className={`btn btn-outline ${css.confirm}`} disabled={confirming} onClick={() => void confirmHealth()}>
                    {confirming ? W.confirming : W.confirm}
                  </button>
                )}>
                <b>{health.ask.title}</b>
                <span className={css.askLine}>{health.ask.line}</span>
              </Callout>
              {confirmError && <p className={css.askError} role="alert">{confirmError}</p>}
            </div>
          )}
        </ClubSection>
      </div>
      {copiesOf && <CopiesWindow open={copiesOf} onClose={() => setCopiesOf(null)} />}

      <ClubSection title={W.parents} list={isPhone && parents.length > 0}>
        {parents.length === 0 ? <p className={repKit.dim}>{W.noParents}</p> : isPhone ? (
          <ClubRowList inset label={W.parents}>
            {parents.map((p, i) => p.personId
              ? <ClubRow key={p.personId} as="link" href={parentHref(p.personId)} title={p.name} caption={contactOf(p)} chevron />
              : <ClubRow key={`typed-${i}`} title={p.name} caption={[contactOf(p), W.typedOnly].filter(Boolean).join(' · ')} />)}
          </ClubRowList>
        ) : (
          <div className={repKit.tableFrame}>
            <table className={repKit.table}>
              <tbody>
                {parents.map((p, i) => (
                  <tr key={p.personId ?? `typed-${i}`}>
                    <td style={{ width: '30%' }}>
                      {p.personId
                        ? <Link className={repKit.nameLink} href={parentHref(p.personId)} aria-label={W.openFamily(p.name)}>{p.name}</Link>
                        : <span className={fam.childName}>{p.name}</span>}
                    </td>
                    <td className={repKit.dim}>
                      {contactOf(p)}
                      {!p.personId && <span className={fam.ladder}>{W.typedOnly}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClubSection>
    </div>
  );
}

interface CopiesOpen { title: string; eyebrow: string; copies: DocumentCopy[] }

function DocumentsBlock({ block, isPhone, labelled, onEarlier }: {
  block: ChildPageDocuments; isPhone: boolean; labelled: boolean; onEarlier: (title: string, copies: DocumentCopy[]) => void;
}) {
  const label = labelled ? <p className={css.blockLabel}>{W.teamDocs(block.teamName, block.seasonName)}</p> : null;
  if (isPhone) {
    return (
      <div>
        {label}
        <p className={css.sentence}>{documentsSentence(block.rows, block.seasonYear)}</p>
      </div>
    );
  }
  return (
    <div>
      {label}
      <div className={repKit.tableFrame}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col">{W.colDocument}</th>
              {block.seasonYear != null && <th scope="col">{W.colFor(block.seasonYear)}</th>}
              <th scope="col">{W.colLastSigned}</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map(r => (
              <tr key={r.documentType}>
                <td>
                  <span className={fam.childName}>{r.label}</span>
                  {r.validity && <span className={fam.ladder}>{r.validity}</span>}
                </td>
                {block.seasonYear != null && <td>{r.chip && <RepChip tone={r.tone ?? 'neutral'}>{r.chip}</RepChip>}</td>}
                <td className={r.last ? undefined : repKit.dim}>
                  {r.last ? (
                    <span className={css.last}>
                      <span className={r.last.isDate ? css.date : undefined}>
                        {r.last.text}
                        {r.last.houseLeague && <span className={fam.ladder}>{W.houseLeague}</span>}
                      </span>
                      {r.copies.length > 1 && <EarlierLink doc={r.label} n={r.copies.length - 1} onOpen={() => onEarlier(r.label, r.copies)} />}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** "+3 earlier": the kit's inline link at the support size, on the value's line. It opens a window, so it says so. */
function EarlierLink({ doc, n, onOpen }: { doc: string; n: number; onOpen: () => void }) {
  return (
    <button type="button" className={`${repKit.inlineLink} ${css.earlier}`} aria-haspopup="dialog" aria-label={W.earlierLabel(doc, n)} onClick={onOpen}>
      {W.earlier(n)}
    </button>
  );
}

/** Every signed copy of one document, newest first — it reads; nothing in it is typed, so it has no foot. */
function CopiesWindow({ open, onClose }: { open: CopiesOpen; onClose: () => void }) {
  return (
    <KitDialog kind="form" record size="medium" eyebrow={open.eyebrow} title={open.title} onClose={onClose}>
      <p>{W.copiesCount(open.copies.length)}</p>
      <div className={repKit.tableFrame}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col">{W.colSeason}</th>
              <th scope="col">{W.colDate}</th>
              <th scope="col">{W.colHow}</th>
            </tr>
          </thead>
          <tbody>
            {open.copies.map((c, i) => (
              <tr key={i}>
                <td>
                  <span className={fam.childName}>{copyName(c)}</span>
                  {c.houseLeague && <span className={fam.ladder}>{W.houseLeague}</span>}
                </td>
                <td className={css.date}>{formatStoredDate(c.at)}</td>
                <td className={repKit.dim}>{c.houseLeague ? W.howSignUp : W.howUploaded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </KitDialog>
  );
}
