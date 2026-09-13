'use client';
import { useCallback, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import warm from '@/components/consumer/warmTheme.module.css';
import PlayerRecapView from '@/components/family/PlayerRecapView';
import type { PlayerSeasonRecapPayload } from '@/lib/rep-player-season-recap';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The coach's preview of a player's family season recap (Chunk D 3.2).
 *
 * Two decisions worth stating, because both look odd until you know why:
 *
 * 1. IT RENDERS THE FAMILY'S OWN COMPONENT, inside the consumer warm shell. A preview drawn
 *    by different code is not a preview — it is a second opinion that drifts. Wrapping in the
 *    family's skin also means the coach sees the actual rendering, the way an email preview
 *    pane shows the recipient's view rather than the sender's.
 *
 * 2. IT IS COLLAPSED BY DEFAULT and fetches only when opened. A child's development record is
 *    not something to load onto a screen the coach opened to check a jersey size.
 *
 * 3. IT IS ONE QUIET ROW AT THE FOOT OF THE RECORD TAB (roster + player page review, hub F11,
 *    2026-09-13). It used to be a tinted box with a blue border and a small-caps title sitting
 *    between the coach's own records, in a visual language nothing else on the page used. It is a
 *    preview of an OUTPUT — what the family will read — not a record, so it sits after the
 *    records it is built from, in the portal's quiet-door voice: an eye and a sentence.
 *
 * The route behind it is LIVE-SEASON-ONLY by design (the archive is opt-in): this is the
 * moment a coach can still act on what they see — log a final reading, give an award — which
 * a closed season would not allow anyway.
 */
export default function PlayerRecapPreview({ orgSlug, teamId, playerId, playerFirstName }: {
  orgSlug: string;
  teamId: string;
  playerId: string;
  playerFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [recap, setRecap] = useState<PlayerSeasonRecapPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/recap`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecap(data.recap as PlayerSeasonRecapPayload);
    } catch {
      setError('The preview couldn’t be loaded — try again.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, playerId]);

  // Fetched from the CLICK, not from an effect watching `open`: the effect version re-entered
  // on every state change it caused, and "open the disclosure" is a user event, not a
  // derivation of one.
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !recap && !loading) void load();
  }

  const who = playerFirstName ? `${playerFirstName}’s family` : 'the family';
  return (
    // data-sandbox-tour: the beat the demo's "read what a parent gets" step rings. Inert off a
    // demo org — the attribute carries no styling and no behaviour.
    <div data-sandbox-tour="family-recap">
      <div className={styles.recapRow}>
        <button type="button" className={styles.recapRowBtn} onClick={toggle} aria-expanded={open}>
          {open ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {open ? `Hide what ${who} will read at season’s end` : `Preview what ${who} will read at season’s end`}
        </button>
      </div>
      {open && (
        <div className={styles.recapPreview}>
          {loading && <CoachLoading label="Loading the preview…" inline />}
          {error && <p className={styles.detailPlaceholder}>{error}</p>}
          {recap && (
            <div className={warm.warm}>
              <PlayerRecapView recap={recap} isPreview />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
