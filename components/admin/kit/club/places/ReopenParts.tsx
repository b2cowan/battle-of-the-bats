'use client';
/**
 * WHAT BOTH REOPEN WINDOWS SHARE (one row's, `ReopenPlaceWindow`; two rows or more, `ReopenSeveralWindow`): what the site
 * says without the chosen set, the server's figures for it, the press, the lines that say what it does to the rep marks
 * and the postponed games, and the result.
 * ⚖ The counts and the coaches are the server's (`reopenPreview`), never added up in the browser. The press reopens the
 *   whole set at once (`POST …/place-closures/reopen`): one read of whom to tell, one coach send.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import {
  CLOSE_WORDS as W, REOPEN_MAX_IDS, closedParks, oneSentence, reopenSite, type ReopenPreview, type ReopenSite, type StaffClosure,
} from '@/lib/place-closure-window';
import StripPreview from './StripPreview';
import s from './ClosePlace.module.css';

export interface ReopenDone { reopened: string[]; failed: string[]; coaches: number; stillWaiting: number; seasonIds: string[] }

/** A press that reopened something. */
export interface ReopenOutcome {
  d: ReopenDone;
  /** The closures that didn't come off, by name. */
  failedNames: string[];
  /** The closures that did, and whether that is every one chosen. */
  gone: ReadonlySet<string>;
  all: boolean;
  /** What the site says now, read over what DID reopen: a closure that failed is still showing. */
  after: ReopenSite;
  /** The one team whose coach was told, by name (null: several, or a person who sees counts only). */
  team: string | null;
}

export function useReopenSet(orgSlug: string, ids: readonly string[], closures: readonly StaffClosure[],
  diamondParks: ReadonlySet<string>, onReopened: () => void) {
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const idsKey = ids.join(',');
  const [nowIso] = useState(() => new Date().toISOString());
  const site = useMemo(() => reopenSite(closures, new Set(ids), diamondParks, nowIso), [closures, ids, diamondParks, nowIso]);
  // The server's figures for the chosen set, read again when the set changes (the last read wins).
  const [preview, setPreview] = useState<{ key: string; p: ReopenPreview } | null>(null);
  // The set whose read failed: a new set of ticks reads afresh, without the old error standing over it.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const tooMany = ids.length > REOPEN_MAX_IDS;
  useEffect(() => {
    if (!idsKey || tooMany) return;
    let stale = false;
    // org-slug-ok: `q` is built from the orgSlug prop above
    fetch(`/api/admin/org/place-closures/reopen?${q}&ids=${idsKey}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(d => { if (stale) return; if (d) { setPreview({ key: idsKey, p: d as ReopenPreview }); setFailedKey(null); } else setFailedKey(idsKey); });
    return () => { stale = true; };
  }, [q, idsKey, tooMany]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = preview?.key === idsKey ? preview.p : null;

  /** The press. Null when nothing reopened (the window says why and stays open). */
  async function press(): Promise<ReopenOutcome | null> {
    setBusy(true); setError(null);
    // org-slug-ok: `q` is built from the orgSlug prop above
    const res = await fetch(`/api/admin/org/place-closures/reopen?${q}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok || !data) { setError((data as { error?: string } | null)?.error ?? W.reopenPressFailed); return null; }
    const d = data as ReopenDone;
    onReopened();
    const failedNames = closedParks(closures.filter(c => d.failed.includes(c.id)));
    if (!d.reopened.length) { setError(W.reopenFailed(failedNames)); return null; }
    const gone = new Set(d.reopened);
    const all = ids.every(id => gone.has(id));
    return { d, failedNames, gone, all, after: all ? site : reopenSite(closures, gone, diamondParks, nowIso), team: p?.team ?? null };
  }

  return { nowIso, site, covered: site.kind === 'covered', p, readFailed: failedKey === idsKey, tooMany, busy, error, press };
}

/**
 * The result of either window: what the site says now and who was emailed, the strip where that is more than a sentence,
 * the window's own warnings, what didn't reopen, and the postponed games that still need a date (with the door to them).
 */
export function ReopenResult({ orgSlug, eyebrow, title, done, covered, coveredSaid, goneWord, children, onClose }: {
  orgSlug: string;
  eyebrow?: string;
  title: string;
  done: ReopenOutcome;
  /** The question was a "Remove …'s own closure": the site doesn't change and no new date is asked for. */
  covered: boolean;
  /** What a window whose closures were all covered says, from the sentence that covers them. */
  coveredSaid: (bySentence: string) => string;
  /** "Your site no longer says it's closed" · "… they're closed" · "… anything is closed". */
  goneWord: 'it' | 'they' | 'anything';
  children?: ReactNode;
  onClose: () => void;
}) {
  const { d, after, failedNames, team } = done;
  const seasonHref = d.seasonIds[0] ? `/${orgSlug}/admin/house-league/seasons/${d.seasonIds[0]}/schedule` : null;
  const still = after.kind === 'stops' ? after.still : null;
  const sentence = oneSentence(still);
  const coachWords = W.reopenedCoaches(d.coaches, team);
  // More than one sentence still shows: the strip itself, under its own lead, after what the press did.
  const strip = still && !sentence ? still : null;
  return (
    <KitDialog kind="form" eyebrow={eyebrow} title={title} onClose={onClose}
      footer={(
        <>
          <DialogCancel>{W.done}</DialogCancel>
          {!covered && d.stillWaiting > 0 && seasonHref && <Link className="btn btn-lime" href={seasonHref}>{W.newDates}</Link>}
        </>
      )}>
      {(!strip || coachWords) && (
        <div className={`${ck.notice} ${ck.noticeGood}`} aria-live="polite">
          <CheckCircle2 size={16} aria-hidden />
          <span className={ck.noticeBody}>
            {after.kind === 'covered'
              ? coveredSaid(after.by)
              : sentence
                ? <>{W.reopenedNowSays}<b>{sentence}</b></>
                : !strip && W.reopenedGone(goneWord)}
            {strip ? coachWords.trim() : coachWords}
          </span>
        </div>
      )}
      {strip && <StripPreview strip={strip} lead={W.reopenedNowShows} />}
      {children}
      <ReopenLeftOver failedNames={failedNames} stillWaiting={covered ? 0 : d.stillWaiting} />
    </KitDialog>
  );
}

/** The question's figures: loading or failed, the marks that come off and who hears, the games that stay marked, and the
 *  postponed games still waiting (never said where the chosen closures are only covered ones). */
export function ReopenFigures({ p, readFailed, tooMany, marksWhat, covered }: {
  p: ReopenPreview | null; readFailed: boolean; tooMany: boolean;
  /** "the diamond" · "the places"; null when every place is among them. */
  marksWhat: string | null;
  covered: boolean;
}) {
  return (
    <>
      {tooMany && <p className={repKit.formError} role="alert">{W.reopenTooMany}</p>}
      {!p && !readFailed && !tooMany && <p className={ck.hint}>{W.reopenLoading}</p>}
      {readFailed && <p className={repKit.formError} role="alert">{W.reopenReadFailed}</p>}
      {p && p.marksOff > 0 && <p className={s.para}>{W.reopenMarksSet(p.marksOff, p.team, marksWhat)}</p>}
      {p && p.kept > 0 && <p className={s.para}>{W.reopenKept(p.kept, p.keptWhile)}</p>}
      {!covered && p && p.stillWaiting > 0 && <p className={s.para}><b>{W.reopenStill(p.stillWaiting)}</b>{W.reopenStillRest(p.stillWaiting)}</p>}
    </>
  );
}

/** An amber line in a Reopen window. */
export function ReopenWarn({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${ck.notice} ${ck.noticeWarn}`}>
      <AlertTriangle size={16} aria-hidden />
      <span className={ck.noticeBody}>{children}</span>
    </div>
  );
}

/** The result's warnings: what didn't reopen, and the postponed games that still need a date. */
function ReopenLeftOver({ failedNames, stillWaiting }: { failedNames: readonly string[]; stillWaiting: number }) {
  return (
    <>
      {failedNames.length > 0 && <ReopenWarn>{W.reopenFailed(failedNames)}</ReopenWarn>}
      {stillWaiting > 0 && <ReopenWarn><b>{W.reopenedStill(stillWaiting)}</b>{W.reopenedStillRest(stillWaiting)}</ReopenWarn>}
    </>
  );
}
