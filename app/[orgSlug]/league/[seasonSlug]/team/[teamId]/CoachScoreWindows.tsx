'use client';
import { useState, type RefObject } from 'react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import { SCORE_WORDS as W, REPORT_NOTE_MAX, type CoachScoreRow } from '@/lib/league-coach-scores';
import { scoresToSave } from '@/lib/league-season-calendar';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import w from './CoachScoreWindows.module.css';

/**
 * THE COACH'S SCORE WINDOWS (House League 9e-3; COPY §6–§7, drawings c2–c3): Enter / Change the score for the home coach,
 * Report this score for the away coach. ⚖ THE ONE WINDOW (`KitDialog`, the coach page's Subscribe precedent): a 520 window
 * at a desk, the whole screen on a phone with its foot in view. Both carry what they saw (`seen`): a score that changed
 * while the window was open is refused, and the page is read again behind the error. A dropped connection keeps what was
 * typed ("Couldn't save…"); nothing is queued.
 */

type Props = {
  row: CoachScoreRow;
  endpoint: string;
  opener: RefObject<HTMLButtonElement | null>;
  /** The press was refused as stale: the page reads again (the window stays, saying so). */
  onStale: () => void;
  onClose: () => void;
  onSaved: () => void;
};

/** One press; its refusal said in the window, which stays where it was. */
async function press(endpoint: string, body: Record<string, unknown>, onStale: () => void): Promise<string | null> {
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
    // Stale, or closed since the window opened (a report, a Keep): the page reads again so the row says what is true now.
    if (data.code === 'changed' || data.code === 'closed') onStale();
    return data.error ?? W.err.noSignal;
  } catch {
    return W.err.noSignal;
  }
}

export function EnterScoreWindow({ row, standings, endpoint, opener, onStale, onClose, onSaved }: Props & { standings: boolean }) {
  const had = row.homeScore != null && row.awayScore != null;
  const seed = { home: had ? String(row.homeScore) : '', away: had ? String(row.awayScore) : '' };
  const [home, setHome] = useState(seed.home);
  const [away, setAway] = useState(seed.away);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scores = scoresToSave(home, away);
  const dirty = home !== seed.home || away !== seed.away;
  // Both boxes emptied on a score already in (COPY §14.1: allowed, this line is the only guard).
  const clearing = had && !home.trim() && !away.trim();
  // Nothing to save when nothing changed: a no-change Save would re-stamp the score as this coach's and move the game's mark.
  const blocked = !scores || (!had && !home.trim() && !away.trim()) || (had && !dirty);

  async function save() {
    if (blocked || saving || !scores) return;
    setSaving(true);
    setError(null);
    const refused = await press(endpoint, { homeScore: scores.homeScore, awayScore: scores.awayScore, seen: row.seen }, onStale);
    setSaving(false);
    if (refused) setError(refused);
    else onSaved();
  }

  return (
    <KitDialog kind="form" eyebrow={W.winSub(row.homeName, row.awayName, row.startsAt)} title={had ? W.change : W.enter}
      onClose={onClose} busy={saving} dirty={dirty} opener={opener} ownType
      footerStart={row.enteredAs ? <span>{W.winBy(row.enteredAs)}</span> : undefined}
      footer={<>
        <DialogCancel className={shared.btnSecondary}>{W.cancel}</DialogCancel>
        <button type="button" className={shared.btnPrimary} onClick={() => void save()} disabled={saving || blocked}>
          {saving ? W.saving : W.save}
        </button>
      </>}>
      {error && <p className={w.error} role="alert">{error}</p>}
      <div className={w.pair}>
        <label className={shared.field}>
          <span className={shared.label}>{W.winHome(row.homeName)}</span>
          <input className={`${shared.input} ${w.box}`} type="number" min={0} inputMode="numeric" value={home}
            aria-label={W.box(row.homeName)} onChange={e => { setHome(e.target.value); setError(null); }} />
        </label>
        <span className={w.dash} aria-hidden>–</span>
        <label className={shared.field}>
          <span className={shared.label}>{W.winAway(row.awayName)}</span>
          <input className={`${shared.input} ${w.box}`} type="number" min={0} inputMode="numeric" value={away}
            aria-label={W.box(row.awayName)} onChange={e => { setAway(e.target.value); setError(null); }} />
        </label>
      </div>
      <p className={w.hint} role={!scores || clearing ? 'status' : undefined}>
        {!scores ? W.bothScores : clearing ? W.clear : W.winHint(standings)}
      </p>
    </KitDialog>
  );
}

export function ReportScoreWindow({ row, endpoint, opener, onStale, onClose, onSaved }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = REPORT_NOTE_MAX - note.length;

  async function send() {
    if (saving || left < 0) return;
    setSaving(true);
    setError(null);
    const refused = await press(endpoint, { note: note.trim() || null, seen: row.seen }, onStale);
    setSaving(false);
    if (refused) setError(refused);
    else onSaved();
  }

  return (
    <KitDialog kind="form" eyebrow={W.repSub(row.homeName, row.homeScore ?? 0, row.awayName, row.awayScore ?? 0, row.startsAt)} title={W.report}
      onClose={onClose} busy={saving} dirty={!!note.trim()} opener={opener} ownType
      footerStart={<span>{W.repFoot}</span>}
      footer={<>
        <DialogCancel className={shared.btnSecondary}>{W.cancel}</DialogCancel>
        <button type="button" className={shared.btnPrimary} onClick={() => void send()} disabled={saving || left < 0}>
          {saving ? W.repSending : W.repSend}
        </button>
      </>}>
      {error && <p className={w.error} role="alert">{error}</p>}
      <label className={shared.field}>
        <span className={shared.label}>{W.repLabel}</span>
        <textarea className={`${shared.textarea} ${w.note}`} rows={3} value={note} maxLength={REPORT_NOTE_MAX}
          placeholder={W.repPlaceholder} onChange={e => { setNote(e.target.value); setError(null); }} />
      </label>
      <p className={w.hint}>{W.repHint}{note.length > 0 && <span className={w.left}> {W.left(left)}</span>}</p>
    </KitDialog>
  );
}
