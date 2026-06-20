'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, X, TriangleAlert } from 'lucide-react';

type MigrationSummary = {
  ok?: boolean;
  roster?: { migrated: number; needGuardian?: string[]; nameSplitUncertain?: string[] };
  schedule?: { migrated: number; cancelled: number };
  fees?: { migrated: number; dueDateDefaulted: number; skippedZero: number; skippedNoPlayer: number };
  announcementsMigrated?: boolean;
};

/**
 * One-time "here's what we brought over + check these" banner shown on the Premium team overview
 * after a free→Premium upgrade (Coach Premium Upgrade Phase 4). Self-fetches the migration summary;
 * renders nothing if there isn't one (or it's been dismissed). Honest by design — surfaces the
 * lossy edges (missing guardian emails, uncertain name splits, defaulted fee due dates, skipped
 * fees, announcements not carried) rather than pretending it was a perfect copy.
 */
export default function UpgradeSummaryBanner({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/upgrade-summary`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.summary) setSummary(data.summary as MigrationSummary);
    } catch { /* non-fatal — banner just won't show */ }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function dismiss() {
    setDismissing(true);
    setSummary(null);
    try { await fetch(base, { method: 'POST' }); } catch { /* best-effort */ }
  }

  if (!summary) return null;

  const r = summary.roster ?? { migrated: 0 };
  const s = summary.schedule ?? { migrated: 0, cancelled: 0 };
  const f = summary.fees ?? { migrated: 0, dueDateDefaulted: 0, skippedZero: 0, skippedNoPlayer: 0 };

  const broughtOver: string[] = [];
  if (r.migrated) broughtOver.push(`${r.migrated} player${r.migrated === 1 ? '' : 's'}`);
  if (s.migrated) broughtOver.push(`${s.migrated} schedule event${s.migrated === 1 ? '' : 's'}`);
  if (f.migrated) broughtOver.push(`${f.migrated} fee${f.migrated === 1 ? '' : 's'}`);

  const checkThese: string[] = [];
  const needGuardian = r.needGuardian?.length ?? 0;
  const nameUncertain = r.nameSplitUncertain?.length ?? 0;
  if (needGuardian) checkThese.push(`${needGuardian} player${needGuardian === 1 ? '' : 's'} need a guardian email — dues reminders stay off until you add one.`);
  if (nameUncertain) checkThese.push(`${nameUncertain} player name${nameUncertain === 1 ? '' : 's'} may need a first/last name fix.`);
  if (f.dueDateDefaulted) checkThese.push(`${f.dueDateDefaulted} fee${f.dueDateDefaulted === 1 ? '' : 's'} got a default due date — confirm the real date on the Dues tab.`);
  if (f.skippedNoPlayer) checkThese.push(`${f.skippedNoPlayer} fee${f.skippedNoPlayer === 1 ? ' was' : 's were'} not linked to a player and weren't carried over.`);
  if (f.skippedZero) checkThese.push(`${f.skippedZero} $0 fee${f.skippedZero === 1 ? ' was' : 's were'} skipped.`);
  checkThese.push('Past team announcements aren’t carried over — the announcements feature is ready to use here.');
  if (summary.ok === false) checkThese.push('Some items hit a problem during import — double-check your roster, schedule, and fees.');

  return (
    <div style={{
      border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)',
      borderRadius: 12, padding: '1rem 1.1rem', marginBottom: '1.25rem', position: 'relative',
    }}>
      <button
        type="button"
        onClick={dismiss}
        disabled={dismissing}
        aria-label="Dismiss"
        style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: 'rgba(241,245,249,0.5)', cursor: 'pointer', padding: 4 }}
      >
        <X size={16} />
      </button>
      <p style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: '#fff' }}>
        <CheckCircle2 size={16} style={{ color: '#60A5FA' }} aria-hidden />
        Welcome to Premium — your team came with you
      </p>
      <p style={{ margin: '0 0 0.6rem', color: 'rgba(241,245,249,0.82)', fontSize: '0.9rem' }}>
        {broughtOver.length > 0
          ? `We brought over ${broughtOver.join(', ')} from your free portal${s.cancelled ? ` (including ${s.cancelled} cancelled event${s.cancelled === 1 ? '' : 's'})` : ''}.`
          : 'Your Premium portal is ready.'}
      </p>
      {checkThese.length > 0 && (
        <>
          <p style={{ margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'rgba(245,158,11,0.95)', fontSize: '0.82rem' }}>
            <TriangleAlert size={14} aria-hidden /> A few things to check
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'rgba(241,245,249,0.72)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            {checkThese.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
