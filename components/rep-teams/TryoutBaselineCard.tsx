'use client';
import { useState, useEffect, useCallback } from 'react';
import { Sprout, Check, ArrowRight } from 'lucide-react';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import { FOCUS_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import TryoutSnapshotCard from '@/components/coaches/TryoutSnapshotCard';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import type { RepTryoutBaselineSnapshot, RepTryoutBaselineCategory } from '@/lib/types';
import day from './TryoutDayCard.module.css';
import styles from './TryoutBaselineCard.module.css';

/**
 * Start development from tryouts — the seeding walkthrough (Tryout Insights Phase 2, work items
 * B2 + B3; mockups v1 frame 04; rulings R4 + R5).
 *
 * ⚠ **R5 IS THE SHAPE OF THIS COMPONENT, not a check inside it.** A suggestion is a *proposal*
 * rendered next to a picker the coach resolves; leaving a picker empty is "Don't add", which is a
 * complete and first-class answer that saves the baseline alone. There is deliberately no
 * "accept all" button — it would turn two decisions into one reflex, and the focus vocabulary is
 * exactly what a reflex pollutes ("one word for one thing", 18f05650).
 *
 * ⚠ **Minting rides the vocabulary's own gate.** New words are created through the focus-tags
 * route via `useFocusTags` — the same picker and the same 409-on-duplicate rule the practice
 * planner uses — never invented here from a scorecard category's label.
 *
 * ⚠ **The client never posts a snapshot.** It posts a player id and the focus areas the coach
 * confirmed; the server refreezes the snapshot from the scores. What is rendered here is only
 * ever a preview of what the server will store.
 */

interface SeedPlayer {
  rosterPlayerId: string;
  name: string;
  playerNumber: string | null;
  snapshot: RepTryoutBaselineSnapshot;
  hasSnapshot: boolean;
  seededAt: string | null;
  suggestions: RepTryoutBaselineCategory[];
}

interface Payload {
  players: SeedPlayer[];
  tags: PickableTag[];
}

/** The picker key used when a player has no suggestions to resolve — one free-form focus area. */
const FREE_PICK = 'free';

interface Props {
  /** `/api/coaches/{orgSlug}/teams/{teamId}/tryout-baselines` */
  apiBase: string;
  orgSlug: string;
  teamId: string;
  /** True while the Build tab is the visible panel — the card loads only when it is on screen. */
  active: boolean;
  onError?: (msg: string) => void;
}

export default function TryoutBaselineCard({ apiBase, orgSlug, teamId, active, onError }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null); // roster player ids, in walkthrough order
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, string[]>>({}); // suggestion key → [tagId]
  const [busy, setBusy] = useState(false);
  const [stepErr, setStepErr] = useState('');
  const [seededThisRun, setSeededThisRun] = useState(0);

  // The team's shared 'focus' vocabulary, seeded from this route's own payload so the picker has
  // words on first paint without a second round trip.
  const { tags, setTags, createTag } = useFocusTags(orgSlug, teamId, { skipFetch: true });

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return; // quiet — a coach without the capability simply gets no card
      const json: Payload = await res.json();
      setData(json);
      setTags(json.tags ?? []);
    } catch { /* non-blocking */ }
  }, [apiBase, setTags]);

  useEffect(() => { if (active) load(); }, [active, load]);

  if (!data) return null;

  const fromTryout = data.players;
  // Nothing came off a tryout this season ⇒ there is nothing to seed FROM, and an entry card
  // promising a walkthrough that opens on zero players would be a dead end.
  if (fromTryout.length === 0) return null;

  const unseeded = fromTryout.filter(p => !p.seededAt);
  const seededCount = fromTryout.length - unseeded.length;

  const currentId = queue ? queue[step] : null;
  const current = currentId ? fromTryout.find(p => p.rosterPlayerId === currentId) ?? null : null;

  function begin() {
    // ⚠ Already-seeded players are SKIPPED by default (plan §5) — re-entering must never invite
    // a coach to re-do work, and a baseline is never overwritten anyway.
    setQueue(unseeded.map(p => p.rosterPlayerId));
    setStep(0);
    setPicked({});
    setSeededThisRun(0);
    setStepErr('');
  }

  function advance() {
    setPicked({});
    setStepErr('');
    const next = step + 1;
    // Past the last player ⇒ the walkthrough closes and the entry card takes over, now showing
    // what got done. Deliberately not a "finished!" screen: the finish line is the roster.
    if (!queue || next >= queue.length) { setQueue(null); setStep(0); } else { setStep(next); }
  }

  async function save() {
    if (!current || busy) return;
    setBusy(true);
    setStepErr('');
    try {
      // Only what the coach actually resolved, and only from pickers currently ON SCREEN. A
      // background reload can change this player's suggestions (another coach seeded them, or the
      // scorecard changed); a tag chosen against a suggestion that has since disappeared must not
      // ride along invisibly. A picker left empty contributes nothing — that is "Don't add", and
      // it is a complete answer.
      const visibleKeys = current.suggestions.length > 0
        ? current.suggestions.map(c => c.key)
        : [FREE_PICK];
      const focusAreas = visibleKeys
        .flatMap(key => picked[key] ?? [])
        .map(tagId => tags.find(t => t.id === tagId))
        .filter((t): t is PickableTag => !!t)
        .map(t => ({ focusArea: t.name, tagId: t.id }));

      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterPlayerId: current.rosterPlayerId, focusAreas }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not save this baseline.');
      // ⚠ An unscored player's focus areas save, but NO baseline is written — there is nothing to
      // record yet, and one may exist later if their scores arrive. So they stay in the queue and
      // are not counted, which is the honest answer rather than a tidier one. `baselineSet` is
      // also true when another tab had already seeded them, since they do now have one.
      if (json?.baselineSet) { markSeeded(current.rosterPlayerId); setSeededThisRun(n => n + 1); }
      advance();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not save this baseline.';
      setStepErr(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  /** Local truth after a save, so the entry card's counts are right without a refetch. */
  function markSeeded(rosterPlayerId: string) {
    setData(d => d && ({
      ...d,
      players: d.players.map(p => p.rosterPlayerId === rosterPlayerId
        ? { ...p, seededAt: new Date().toISOString(), suggestions: [] }
        : p),
    }));
  }

  /** One picker + its "Don't add" reassurance. Same control whether it resolves a suggestion or
   *  stands alone, so the two paths can never offer different affordances. */
  function picker(key: string, label: string) {
    const chosen = picked[key] ?? [];
    return (
      <>
        <TagPicker
          all={tags}
          selected={chosen}
          onChange={next => setPicked(p => ({ ...p, [key]: next }))}
          onCreate={createTag}
          single
          manage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
          onManageChanged={load}
          label={label}
          emptyHint="No focus words yet — type one to make your team’s first."
        />
        {chosen.length === 0 && <p className={styles.notAdded}>Not added — that’s a complete answer.</p>}
      </>
    );
  }

  // ── The entry card (always) ──
  const entry = (
    <div className={day.card}>
      <div className={day.head}>
        <h3 className={day.title}><Sprout size={16} /> Start development from tryouts</h3>
        {unseeded.length > 0 ? (
          // ⚠ Disabled by the STEP being on screen, not by the queue existing (/review, 2026-08-02).
          // A background reload that drops the queued player — they were cut, or another coach
          // seeded them — leaves a queue with nothing to render; keying the button off `queue`
          // disabled Begin permanently with no way back.
          <button type="button" className={styles.beginBtn} onClick={begin} disabled={!!current}>
            Begin — {unseeded.length} player{unseeded.length === 1 ? '' : 's'}
          </button>
        ) : (
          <span className={styles.doneChip}>
            <Check size={12} aria-hidden /> All {fromTryout.length} baseline{fromTryout.length === 1 ? '' : 's'} set
          </span>
        )}
      </div>
      <p className={styles.intro}>
        {unseeded.length > 0
          ? 'Set each new player’s baseline and pick what to work on first. You confirm every suggestion — nothing is saved without you.'
          : 'Every player from this tryout has a baseline on their development page. It’s set once a season and never overwritten.'}
      </p>
      {seededCount > 0 && unseeded.length > 0 && (
        <p className={styles.intro}>
          {seededCount} already done — they’re skipped.
        </p>
      )}
    </div>
  );

  if (!current) return entry;

  // ── The step ──
  const total = queue?.length ?? 0;
  return (
    <>
      {entry}
      <div className={day.card}>
        <div className={styles.stepHead}>
          <span className={styles.stepCount}>Player {step + 1} of {total}</span>
          {seededThisRun > 0 && (
            <span className={styles.stepProgress}>
              <Check size={11} aria-hidden /> {seededThisRun} baseline{seededThisRun === 1 ? '' : 's'} set
            </span>
          )}
        </div>
        <p className={styles.playerLine}>
          {current.name}{current.playerNumber ? ` · #${current.playerNumber}` : ''}
        </p>

        {current.hasSnapshot ? (
          <TryoutSnapshotCard snapshot={current.snapshot} variant="inline" />
        ) : (
          <p className={styles.noSnapshot}>
            No snapshot — nobody scored this player at the tryout. Set their focus areas by hand, or
            skip and do it from their profile later. Nothing is recorded as a baseline, so if their
            scores land later they can still get one.
          </p>
        )}

        <div className={styles.sectionLabel}>
          {current.suggestions.length > 0 ? 'Suggested focus — you decide' : 'Focus to start with'}
        </div>

        {current.suggestions.length === 0 && current.hasSnapshot && (
          <p className={styles.notAdded}>
            Nothing scored below the middle of your scorecard — no suggestion to make. Add a focus
            area if you have one in mind.
          </p>
        )}

        {current.suggestions.length > 0 ? current.suggestions.map(cat => (
          <div key={cat.key} className={styles.suggestion}>
            <div className={styles.suggestionHead}>
              <span className={styles.weakChip}>{cat.label} · {cat.avg?.toFixed(1)}</span>
              <span className={styles.suggestionArrow} aria-hidden>→</span>
            </div>
            {picker(cat.key, `Add a focus area for ${cat.label}`)}
          </div>
        )) : (
          // No suggestion to resolve — one free-form picker, so a coach who already knows what
          // this player should work on is never made to open their profile to say so.
          <div className={styles.suggestion}>{picker(FREE_PICK, 'Add a focus area')}</div>
        )}

        <p className={styles.rule}>
          {current.suggestions.length > 0
            ? 'Suggestions come from this player’s lowest-scoring categories, and only ones below the middle of your scale. '
            : ''}
          Focus areas use your team’s existing vocabulary — you can match one or create one, but
          nothing is created silently.
        </p>

        {stepErr && <p className={styles.error} role="alert">{stepErr}</p>}

        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.82rem' }}
            disabled={busy} onClick={advance}>
            Skip this player
          </button>
          <span className={styles.spacer} />
          <button type="button" className="btn btn-lime" style={{ fontSize: '0.82rem' }}
            disabled={busy} onClick={save}>
            {busy ? 'Saving…' : (
              // An unscored player has no baseline to save — only their focus areas — and the
              // button must not promise otherwise.
              <>Save {current.hasSnapshot ? 'baseline' : 'focus'} &amp; {step + 1 >= total ? 'finish' : 'next'} <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
