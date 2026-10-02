'use client';
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useBackStep } from '@/components/coaches/useBackStep';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import { formatInOrgZone } from '@/lib/timezone';
import { lineupModeLabel } from '@/lib/lineup-grid';
import type { SportPack } from '@/lib/sports';
import type { RepLineupMode, RepTeamLineupTemplate } from '@/lib/types';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './LineupSaveTemplate.module.css';

/**
 * SAVE AS TEMPLATE — the body of the builder's window (Tools › Save as template…; owner rulings D13–D15,
 * 2026-10-02, hub screen 9). The page owns the window's shell (the over-nav drawer, its scrim and head);
 * this owns what is inside it.
 *
 * ⚖ THE NAME DECIDES. One field, one button: a new name saves a new template, and a name the team already
 * has (capitals and spaces aside — the server's own uniqueness rule) turns the button into "Replace “X”…".
 * The team's templates are listed under the field, and tapping one goes straight to the question.
 *
 * ⚖ "ARE YOU SURE" IS A SECOND VIEW INSIDE THE WINDOW, NEVER A POP-UP (D14). Replacing is the one thing
 * here Undo cannot reverse (Undo covers the lineup, not saved templates), so it asks, names what the
 * template holds now and what it will hold, and its button is the portal's red one. A confirm dialog
 * opened from this window is what used to close the old Templates drawer behind it (Mobile plan §13.6 #5).
 *
 * ⚖ CALL-UPS ARE NOT SAVED IN TEMPLATES (D15): a template is the season's shape, and the server only
 * lets one hold the team's own roster. The page leaves them out of what it sends; this says so.
 */
export default function LineupSaveTemplate({
  templates, sportPack, shape, hasCallUps, onSave,
}: {
  templates: RepTeamLineupTemplate[];
  sportPack: SportPack;
  /** This lineup as a template would hold it — call-ups left out. */
  shape: { lineupMode: RepLineupMode; inningCount: number; players: number };
  hasCallUps: boolean;
  /** Saves a new template (replace = null) or replaces one. Throws with the message to show. */
  onSave: (name: string, replace: RepTeamLineupTemplate | null) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [replacing, setReplacing] = useState<RepTeamLineupTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const periods = sportPack.periodLabelPlural.toLowerCase();
  const period = sportPack.periodLabel.toLowerCase();
  const describe = (mode: RepLineupMode, innings: number, players: number) =>
    `${lineupModeLabel(mode)} · ${innings} ${innings === 1 ? period : periods} · ${players} player${players === 1 ? '' : 's'}`;
  const savedOn = (t: RepTeamLineupTemplate) => `saved ${formatInOrgZone(t.updatedAt, { month: 'short', day: 'numeric' })}`;
  const match = templates.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  const newestFirst = [...templates].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const backToName = () => { setReplacing(null); setError(''); };
  useBackStep(!!replacing, backToName);

  async function run(replace: RepTeamLineupTemplate | null) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave(replace ? replace.name : name.trim(), replace);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the template');
    } finally {
      setBusy(false);
    }
  }

  if (replacing) {
    return (
      <div className={shared.lineupTemplateSection}>
        <button type="button" className={styles.back} onClick={backToName} disabled={busy}>
          <ChevronLeft size={17} aria-hidden /> Back
        </button>
        <div className={styles.question}>
          <strong>Replace “{replacing.name}”?</strong>
          <span>Its order, positions, format and {periods} become this lineup’s.</span>
        </div>
        <dl className={styles.facts}>
          <dt>Now</dt><dd>{describe(replacing.lineupMode, replacing.inningCount, replacing.entries.length)} · {savedOn(replacing)}</dd>
          <dt>After</dt><dd>{describe(shape.lineupMode, shape.inningCount, shape.players)} — this lineup</dd>
        </dl>
        <p className={styles.warn}>This can’t be undone. Undo takes back changes to the lineup, not to a saved template.</p>
        <div className={styles.actions}>
          <button type="button" className={shared.btnDanger} disabled={busy} onClick={() => void run(replacing)}>
            {busy ? 'Replacing…' : 'Replace template'}
          </button>
          <button type="button" className={shared.btnSecondary} disabled={busy} onClick={backToName}>Keep it</button>
        </div>
        {error && <p className={shared.errorText}>{error}</p>}
      </div>
    );
  }

  return (
    <form className={shared.lineupTemplateSection}
      onSubmit={e => { e.preventDefault(); if (match) { setError(''); setReplacing(match); } else if (name.trim()) void run(null); }}>
      <input className={shared.input} value={name} onChange={e => { setName(e.target.value); setError(''); }}
        placeholder="e.g. Gold medal game" maxLength={80} aria-label="Template name" />
      {match
        ? <p className={styles.warn}>You already have a template called this. Saving replaces it.</p>
        : <p className={shared.lineupAutoNote}>Saves this lineup’s order, positions, format and {periods}. Templates live on the Lineups page’s Templates tab.</p>}
      {hasCallUps && <p className={shared.lineupAutoNote}>Call-ups aren’t saved in templates — a template is your own roster’s shape.</p>}
      {match ? (
        <button type="submit" className={shared.btnDanger}>Replace “{match.name}”…</button>
      ) : (
        <button type="submit" className={shared.btnPrimary} disabled={!name.trim() || busy || shape.players === 0}>
          {busy ? 'Saving…' : 'Save template'}
        </button>
      )}
      {error && <p className={shared.errorText}>{error}</p>}
      {newestFirst.length > 0 && (
        <>
          <p className={styles.listHead}>Your templates · tap one to replace it</p>
          <div className={styles.list}>
            <CoachRowList inset label="Your templates">
              {newestFirst.map(t => (
                <CoachRow key={t.id} as="button" title={t.name} door="chevron"
                  caption={`${describe(t.lineupMode, t.inningCount, t.entries.length)} · ${savedOn(t)}`}
                  onClick={() => { setError(''); setReplacing(t); }} />
              ))}
            </CoachRowList>
          </div>
        </>
      )}
    </form>
  );
}
