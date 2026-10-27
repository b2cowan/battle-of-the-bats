'use client';

/**
 * Status's screen (Support console Stage 5, drawings A and G). Desk: one table, three bands, a verdict line on top.
 * Phone (S5-D2): one card per line, "Read from" dropped, Read again as the refresh symbol (44 px, named for screen
 * readers). A reading that could not be taken says so and is never shown as fine.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, RefreshCw } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { consoleClock } from '@/lib/console-dates';
import {
  BAND_LABEL, LINE_META, STALE_AFTER_MS, VERDICT_WORD, summarize,
  type Band, type StatusLine, type Verdict,
} from '@/lib/platform-status-lines';
import type { StatusAnswer } from '@/lib/platform-status';
import kit from '../console.module.css';
import styles from './status.module.css';

const BANDS: Band[] = ['sites', 'app', 'database'];
const NOT_JUDGED = "Not judged here: week-over-week trends, database advisors and agent tooling. Those are in the owner's morning check.";

const CHIP: Record<Verdict, string> = {
  fine: kit.chipQuiet, look: kit.chipWarn, act: kit.chipBad, unchecked: kit.chipQuiet, reading: kit.chipQuiet,
};

function doorHref(line: StatusLine): string | null {
  if (!line.door) return null;
  return line.door.to === 'issue' ? `/platform-admin/observability/${line.door.id}` : '/platform-admin/observability';
}

function doorLabel(line: StatusLine): string {
  return line.door?.to === 'issue' ? 'Open the issue' : 'Errors';
}

/** A role that cannot open Errors gets no door to it (it would only bounce back to Today); the line's words stay. */
function forRole(answer: StatusAnswer, canOpenErrors: boolean): StatusAnswer {
  return canOpenErrors ? answer : { ...answer, lines: answer.lines.map(l => ({ ...l, door: null })) };
}

export default function StatusClient({ initial, site, canOpenErrors }: { initial: StatusAnswer; site: 'Production' | 'Staging'; canOpenErrors: boolean }) {
  const [answer, setAnswer] = useState(() => forRole(initial, canOpenErrors));
  // The page opens "Reading…" when the providers are still to be read.
  const [busy, setBusy] = useState(initial.pending);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Every state change here lands after the answer (or its failure) arrives.
  const fetchAnswer = useCallback(async () => {
    try {
      const res = await fetch('/api/platform-admin/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('status');
      setAnswer(forRole((await res.json()) as StatusAnswer, canOpenErrors));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      setNow(Date.now());
    }
  }, [canOpenErrors]);

  const read = () => {
    setBusy(true);
    void fetchAnswer();
  };

  // The providers are still to be read: ask once, as the page opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of the outside providers as the page opens; every setState lands after the fetch answers
    if (initial.pending) void fetchAnswer();
  }, [initial.pending, fetchAnswer]);
  // The header's age moves on its own, so a page left open turns amber at ten minutes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ageMs = now - Date.parse(answer.readAt);
  const stale = ageMs > STALE_AFTER_MS;
  const readWords = stale ? `Read ${Math.round(ageMs / 60_000)} minutes ago` : `Read at ${consoleClock(answer.readAt)}`;
  const summary = summarize(answer.lines);
  const worst = answer.lines.find(l => l.verdict === (summary.tone === 'act' ? 'act' : 'look') && l.door) ?? null;
  const worstHref = worst ? doorHref(worst) : null;

  return (
    <div className={kit.page}>
      <AdminPageHeader
        title="Status"
        titleChips={<span className={`${kit.chip} ${kit.chipQuiet}`}>{site}</span>}
        actions={
          <span className={styles.headActions}>
            <span className={`${styles.readAt}${stale ? ` ${styles.readAtStale}` : ''}`} aria-live="polite">
              {busy ? 'Reading…' : readWords}
            </span>
            <button type="button" className={`btn btn-secondary ${styles.readAgainDesk}`} onClick={read} disabled={busy}>
              Read again
            </button>
            <button type="button" className={styles.readAgainPhone} onClick={read} disabled={busy} aria-label="Read again">
              <RefreshCw size={18} aria-hidden className={busy ? kit.spin : undefined} />
            </button>
          </span>
        }
      />

      {failed && <p className={`${kit.notice} ${kit.noticeBad}`}>Status could not be read just now. Try Read again in a minute.</p>}

      <div className={`${kit.callout}${summary.tone === 'act' ? ` ${kit.calloutBad}` : summary.tone === 'look' ? ` ${kit.calloutWarn}` : ` ${styles.calloutFine}`}`}>
        <span><strong>{summary.lead}</strong>{summary.rest ? ` ${summary.rest}` : ''}</span>
        {worst && worstHref && (
          <span className={kit.calloutEnd}><Link className={kit.door} href={worstHref}>{doorLabel(worst)} ›</Link></span>
        )}
      </div>

      <section className={`${kit.card} ${styles.desk}`}>
        <div className={kit.toolbar}>
          <span className={kit.count}>{answer.lines.length} checks</span>
          <span className={`${kit.toolbarEnd} ${kit.countQuiet}`}>Each is read when this page opens</span>
        </div>
        <div className={kit.tableWrap}>
          <table className={kit.comfortable}>
            <thead>
              <tr><th>Check</th><th>Verdict</th><th>What it says</th><th>What to do</th><th>Read from</th></tr>
            </thead>
            <tbody>
              {BANDS.map(band => (
                <BandRows key={band} band={band} lines={answer.lines.filter(l => LINE_META[l.id].band === band)} />
              ))}
            </tbody>
          </table>
        </div>
        <p className={`${kit.foot} ${kit.caption}`}>{NOT_JUDGED}</p>
      </section>

      <div className={styles.phone}>
        {BANDS.map(band => (
          <section key={band} className={styles.phoneBand}>
            <h2 className={kit.eye}>{BAND_LABEL[band]}</h2>
            {answer.lines.filter(l => LINE_META[l.id].band === band).map(l => <PhoneCard key={l.id} line={l} />)}
          </section>
        ))}
        <p className={kit.caption}>{NOT_JUDGED}</p>
      </div>
    </div>
  );
}

function BandRows({ band, lines }: { band: Band; lines: StatusLine[] }) {
  return (
    <>
      <tr className={styles.bandRow}><th colSpan={5} scope="colgroup">{BAND_LABEL[band]}</th></tr>
      {lines.map(l => {
        const href = doorHref(l);
        return (
          <tr key={l.id}>
            <td data-label="Check" className={styles.name}>{LINE_META[l.id].name}</td>
            <td data-label="Verdict"><span className={`${kit.chip} ${CHIP[l.verdict]}`}>{VERDICT_WORD[l.verdict]}</span></td>
            <td data-label="What it says">{l.says}</td>
            <td data-label="What to do">
              {l.todo}
              {l.todo && href && <> <Link className={`${kit.door} ${kit.doorSm}`} href={href}>{doorLabel(l)} ›</Link></>}
            </td>
            <td data-label="Read from" className={kit.muted}>{LINE_META[l.id].from}</td>
          </tr>
        );
      })}
    </>
  );
}

function PhoneCard({ line }: { line: StatusLine }) {
  const href = line.todo ? doorHref(line) : null;
  const body = (
    <>
      <span className={styles.cardHead}>
        <span className={styles.name}>{LINE_META[line.id].name}</span>
        <span className={`${kit.chip} ${CHIP[line.verdict]}`}>{VERDICT_WORD[line.verdict]}</span>
      </span>
      <span className={styles.says}>{line.says}</span>
      {line.todo && <span className={styles.todo}>{line.todo}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={`${styles.card} ${styles.cardDoor}`}>
      <span className={styles.cardBody}>{body}</span>
      <ChevronRight size={18} aria-hidden className={styles.chev} />
    </Link>
  ) : (
    <div className={styles.card}><span className={styles.cardBody}>{body}</span></div>
  );
}
