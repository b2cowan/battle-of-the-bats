'use client';
/**
 * SETTINGS › "When birthdays count from" (Club Tier Stage 4c-2 Part A, round 2 — ruled 2026-10-22: the club sets its
 * cut-off, per sport). One row per sport the club RUNS (a non-archived rep team or house-league season of that sport), each
 * a month and a day, January 1 unless the club says otherwise. Teams and divisions store YEARS and read their sport's
 * cut-off when shown, so a change re-reads every team of that sport at once — which is why it asks once (C6–C8), in the
 * house question window, and then saves through the house floating pill (C9). Nothing is sent to anyone.
 *
 * ⚖ The OWNER'S ALONE, as Settings (owner ruling 2026-10-22, C11; Stage 13 may revisit): an admin never reaches
 * this card, and `/api/admin/org-settings/birthday-cutoffs` refuses its save from anyone else. The words are `CLUB_TIER_STAGE4C2_COPY.md` C; the rule is
 * `lib/born-years.ts`; the sentences are `lib/birthday-cutoff.ts`.
 */
import { useCallback, useState } from 'react';
import { JAN_1, CUTOFF_MONTHS, cutoffFor, cutoffWords, daysInCutoffMonth, isJan1, type Cutoff } from '@/lib/born-years';
import { cutoffAskBody, cutoffAskTitle, cutoffRowSentence, oneYearSentence, type BirthdaySportRow } from '@/lib/birthday-cutoff';
import { useOrg } from '@/lib/org-context';
import KitDialog from './KitDialog';
import { SavePill } from './RepKit';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';

export type CardData = { applies: boolean; cutoffs: Record<string, Cutoff>; sports: BirthdaySportRow[] };
type Pending = { row: BirthdaySportRow; next: Cutoff };

/** The card's read, as the PAGE loads it (with the settings, so the card appears with everything else — never a beat later). A failed read is null: the card is secondary and stays away. */
export function loadBirthdayCutoffs(orgQuery: string): Promise<CardData | null> {
  return fetch(`/api/admin/org-settings/birthday-cutoffs${orgQuery}`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
    .then((d: CardData) => ({ ...d, cutoffs: d.cutoffs ?? {} }))
    .catch(() => null);
}

export default function BirthdayCutoffCard({ orgQuery, initial }: { orgQuery: string; initial: CardData | null }) {
  const [data, setData] = useState<CardData | null>(initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** What the last Change sent (ONE sport), so Retry sends the same change again and only that. */
  const [lastSent, setLastSent] = useState<{ sport: string; cutoff: Cutoff } | null>(null);
  const { refresh } = useOrg();

  const send = useCallback(async (change: { sport: string; cutoff: Cutoff }) => {
    setLastSent(change);
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/org-settings/birthday-cutoffs${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      });
      if (!res.ok) throw new Error();
      const body = await res.json().catch(() => ({})) as { birthdayCutoffs?: Record<string, Cutoff> };
      // The server merged this one sport into the stored map and sent the whole map back.
      setData(d => {
        if (!d) return d;
        if (body.birthdayCutoffs) return { ...d, cutoffs: body.birthdayCutoffs };
        const cutoffs = { ...d.cutoffs };
        if (isJan1(change.cutoff)) delete cutoffs[change.sport];
        else cutoffs[change.sport] = change.cutoff;
        return { ...d, cutoffs };
      });
      // Team details reads the cut-off from the org context: refresh it so the new date shows without a reload.
      void refresh();
    } catch {
      // The dropdown keeps showing the saved date; the pill says so and offers Retry (C9).
      setSaveError('Couldn’t save');
    } finally {
      setSaving(false);
    }
  }, [orgQuery, refresh]);

  if (!data || !data.applies) return null;
  const { cutoffs } = data;

  /** A dropdown moved: ask once, with the change the club is about to make. The dropdown stays on the saved date until it lands. */
  function ask(row: BirthdaySportRow, saved: Cutoff, change: Partial<Cutoff>) {
    const m = change.m ?? saved.m;
    // A new month keeps the day when it has one, else the month's last (February stops at 28).
    const d = Math.min(change.d ?? saved.d, daysInCutoffMonth(m));
    if (m === saved.m && d === saved.d) return;
    setPending({ row, next: { m, d } });
  }

  function confirm() {
    if (!pending) return;
    const change = { sport: pending.row.id, cutoff: pending.next };
    setPending(null);
    void send(change);
  }

  const pendingSaved = pending ? cutoffFor(cutoffs, pending.row.id) : JAN_1;
  const oneYear = pending ? oneYearSentence(pending.row, pending.next) : null;

  return (
    <>
      <section className={styles.card} aria-labelledby="settings-birthdays">
        <h2 id="settings-birthdays" className={styles.cardTitle}>When birthdays count from</h2>
        <p className={`${ck.hint} ${styles.cutoffLead}`}>Teams and house-league divisions show who can play by birth year, counted from this date. Most leagues count from January 1.</p>
        {data.sports.length === 0 ? (
          <p className={ck.hint}>Your sports show here once you add a rep team or a house-league season.</p>
        ) : (
          <div>
            {data.sports.map(row => {
              const saved = cutoffFor(cutoffs, row.id);
              return (
                <div key={row.id} className={styles.cutoffRow}>
                  <div className={styles.cutoffText}>
                    <div className={styles.cutoffName}>{row.label}</div>
                    <p className={ck.hint}>{cutoffRowSentence(row, saved)}</p>
                  </div>
                  <div className={styles.cutoffPick}>
                    <select
                      className={`${ck.select} ${styles.cutoffMonth}`}
                      aria-label={`${row.label} birthdays count from, month`}
                      value={saved.m}
                      disabled={saving}
                      onChange={e => ask(row, saved, { m: Number(e.target.value) })}
                    >
                      {CUTOFF_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                    </select>
                    <select
                      className={`${ck.select} ${styles.cutoffDay}`}
                      aria-label={`${row.label} birthdays count from, day`}
                      value={saved.d}
                      disabled={saving}
                      onChange={e => ask(row, saved, { d: Number(e.target.value) })}
                    >
                      {Array.from({ length: daysInCutoffMonth(saved.m) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pending && (
        <KitDialog
          kind="question"
          title={cutoffAskTitle(pending.row, pending.next)}
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>Keep {cutoffWords(pendingSaved)}</button>
              <button type="button" className="btn btn-lime" onClick={confirm} disabled={saving}>Change</button>
            </>
          }
        >
          <p>{cutoffAskBody(pending.row, pending.next)}</p>
          {oneYear && <p>{oneYear}</p>}
        </KitDialog>
      )}

      <SavePill
        saving={saving}
        dirty={false}
        error={saveError}
        onRetry={() => { if (lastSent) void send(lastSent); }}
      />
    </>
  );
}
