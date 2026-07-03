'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, CalendarPlus, Link2, Pencil, SlidersHorizontal } from 'lucide-react';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import type { LineupSettings } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

interface SettingsData {
  team: { id: string; name: string; division: string | null; sport: string };
  season: { id: string; name: string; year: number; status: string; lineupSettings: LineupSettings | null };
  nextYearDefault: number;
  scope: {
    isStandalone: boolean;
    isHeadCoach: boolean;
    canManageSeasons: boolean;
    canEditDivision: boolean;
  };
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};

export default function TeamSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [division, setDivision] = useState('');
  const [savingDivision, setSavingDivision] = useState(false);
  const [divisionMsg, setDivisionMsg] = useState('');
  const [divisionError, setDivisionError] = useState('');

  // P3 lineup-rules caps (strings for the number inputs; '' = that rule is off).
  const [caps, setCaps] = useState({ maxPos: '', pitcher: '', minPlay: '' });
  const [savingCaps, setSavingCaps] = useState(false);
  const [capsMsg, setCapsMsg] = useState('');
  const [capsError, setCapsError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`);
      if (!res.ok) throw new Error('Settings could not be loaded');
      const json: SettingsData = await res.json();
      setData(json);
      setDivision(json.team.division ?? '');
      const ls = json.season.lineupSettings;
      setCaps({
        maxPos: ls?.maxInningsPerPosition != null ? String(ls.maxInningsPerPosition) : '',
        pitcher: ls?.pitcherMaxInningsDefault != null ? String(ls.pitcherMaxInningsDefault) : '',
        minPlay: ls?.minInningsPerPlayer != null ? String(ls.minInningsPerPlayer) : '',
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Settings could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function saveDivision(e: React.FormEvent) {
    e.preventDefault();
    setSavingDivision(true);
    setDivisionMsg('');
    setDivisionError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division: division.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDivisionError(json.error ?? 'Could not save the division.');
        return;
      }
      setDivision(json.division ?? '');
      setData(prev => prev ? { ...prev, team: { ...prev.team, division: json.division ?? null } } : prev);
      setDivisionMsg('Saved');
    } catch {
      setDivisionError('Could not save the division.');
    } finally {
      setSavingDivision(false);
    }
  }

  async function saveCaps(e: React.FormEvent) {
    e.preventDefault();
    setSavingCaps(true);
    setCapsMsg('');
    setCapsError('');
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupSettings: {
            maxInningsPerPosition: num(caps.maxPos),
            pitcherMaxInningsDefault: num(caps.pitcher),
            minInningsPerPlayer: num(caps.minPlay),
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setCapsError(json.error ?? 'Could not save.'); return; }
      const ls: LineupSettings | null = json.lineupSettings ?? null;
      setCaps({
        maxPos: ls?.maxInningsPerPosition != null ? String(ls.maxInningsPerPosition) : '',
        pitcher: ls?.pitcherMaxInningsDefault != null ? String(ls.pitcherMaxInningsDefault) : '',
        minPlay: ls?.minInningsPerPlayer != null ? String(ls.minInningsPerPlayer) : '',
      });
      setData(prev => prev ? { ...prev, season: { ...prev.season, lineupSettings: ls } } : prev);
      setCapsMsg('Saved');
    } catch {
      setCapsError('Could not save.');
    } finally {
      setSavingCaps(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading...</p>;
  if (loadError || !data) {
    return (
      <div className={styles.notAssigned}>
        <h2>Settings unavailable</h2>
        <p>{loadError || 'This team could not be loaded.'}</p>
      </div>
    );
  }

  const { team, season, nextYearDefault, scope } = data;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>Team settings</h1>
            <p className={styles.pageSub}>{team.name}</p>
          </div>
        </div>
      </div>

      {/* ── Division ─────────────────────────────────────────────────────── */}
      <section className={styles.setupPanel} aria-labelledby="division-title">
        <div className={styles.setupHeader}>
          <div>
            <p className={styles.setupKicker}>Team</p>
            <h2 id="division-title" className={styles.setupTitle}>Division</h2>
          </div>
          <Pencil size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>

        {scope.canEditDivision ? (
          <form onSubmit={saveDivision} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--white-55)' }}>
              A short label for your competitive level, e.g. &ldquo;U13 Tier 1&rdquo;.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <input
                className={styles.input}
                value={division}
                maxLength={30}
                placeholder="e.g. U13 Tier 1"
                onChange={e => { setDivision(e.target.value); setDivisionMsg(''); }}
              />
              <button type="submit" className={styles.btnPrimary} disabled={savingDivision} style={{ whiteSpace: 'nowrap' }}>
                {savingDivision ? 'Saving...' : 'Save'}
              </button>
            </div>
            {divisionMsg && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--lime, #b6e34d)' }}>{divisionMsg}</p>}
            {divisionError && <p className={styles.errorText} style={{ margin: 0 }}>{divisionError}</p>}
          </form>
        ) : (
          <div>
            <p style={{ margin: '0 0 0.35rem', color: 'var(--white-90)', fontSize: '0.95rem' }}>
              {team.division || <span className={styles.muted}>No division set</span>}
            </p>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--white-55)' }}>
              {scope.isStandalone
                ? 'Only the head coach can change the division.'
                : 'Division is managed by your club admin.'}
            </p>
          </div>
        )}
      </section>

      {/* ── Season ───────────────────────────────────────────────────────── */}
      <section className={styles.setupPanel} aria-labelledby="season-title">
        <div className={styles.setupHeader}>
          <div>
            <p className={styles.setupKicker}>Season</p>
            <h2 id="season-title" className={styles.setupTitle}>
              {season.name} <span className={styles.muted} style={{ fontWeight: 500 }}>· {STATUS_LABEL[season.status] ?? season.status}</span>
            </h2>
          </div>
          <CalendarPlus size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>

        {scope.canManageSeasons ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--white-70)' }}>
              When this season wraps, roll your team into the next one. Your active roster carries forward;
              the schedule starts fresh; and {season.name} moves to read-only Past Seasons.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className={styles.btnPrimary} onClick={() => setModalOpen(true)}>
                Start next season
              </button>
              <Link href={`${base}/history`} className={styles.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Archive size={15} /> Past Seasons
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--white-55)' }}>
              {scope.isStandalone
                ? 'Only the head coach can start a new season.'
                : 'Your club admin manages seasons for this team.'}
            </p>
            <Link href={`${base}/history`} className={styles.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Archive size={15} /> Past Seasons
            </Link>
          </div>
        )}
      </section>

      {/* ── Lineup rules (P3 season-default caps) ────────────────────────── */}
      <section className={styles.setupPanel} aria-labelledby="lineup-rules-title">
        <div className={styles.setupHeader}>
          <div>
            <p className={styles.setupKicker}>Lineups</p>
            <h2 id="lineup-rules-title" className={styles.setupTitle}>Lineup rules</h2>
          </div>
          <SlidersHorizontal size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
        <p style={{ margin: '0 0 0.9rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
          Season defaults the game-day Auto-fill follows. Leave a field blank to turn that rule off.
          You can override any of these for a single game in the Auto-fill menu.
        </p>
        <form onSubmit={saveCaps} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: 480 }}>
          {[
            { key: 'maxPos' as const, label: 'Max innings at one position', min: 1,
              hint: 'Forces rotation so more players get a turn at each spot.' },
            { key: 'pitcher' as const, label: 'Pitching innings cap', min: 1,
              hint: 'Default arm-care limit per pitcher. A player’s own pitcher cap still applies (stricter wins).' },
            { key: 'minPlay' as const, label: 'Minimum innings per player', min: 1,
              hint: 'Everyone gets at least this many innings on the field.' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label className={styles.label} htmlFor={`cap-${f.key}`} style={{ marginBottom: 0 }}>{f.label}</label>
              <input
                id={`cap-${f.key}`}
                className={styles.input}
                type="number"
                min={f.min}
                max={12}
                placeholder="No limit"
                style={{ maxWidth: 140 }}
                value={caps[f.key]}
                onChange={e => { setCaps(c => ({ ...c, [f.key]: e.target.value })); setCapsMsg(''); }}
              />
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--white-55)' }}>{f.hint}</p>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
            <button type="submit" className={styles.btnPrimary} disabled={savingCaps} style={{ whiteSpace: 'nowrap' }}>
              {savingCaps ? 'Saving...' : 'Save rules'}
            </button>
            {capsMsg && <span style={{ fontSize: '0.85rem', color: 'var(--lime, #b6e34d)' }}>{capsMsg}</span>}
            {capsError && <span className={styles.errorText}>{capsError}</span>}
          </div>
        </form>
      </section>

      {/* ── Organization ─────────────────────────────────────────────────── */}
      {scope.isStandalone && (
        <section className={styles.setupPanel} aria-labelledby="org-title">
          <div className={styles.setupHeader}>
            <div>
              <p className={styles.setupKicker}>Organization</p>
              <h2 id="org-title" className={styles.setupTitle}>Parent organization</h2>
            </div>
            <Link2 size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
          <p style={{ margin: '0 0 0.7rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
            Belong to a club or league? Connect your team for recognition, or transfer it in entirely.
            Most teams are invited by their organization — if that happens, you&apos;ll see it on your Overview and here.
          </p>
          <Link
            href={`/${orgSlug}/coaches/link-org`}
            className={styles.btnSecondary}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Link2 size={15} /> Manage organization link
          </Link>
        </section>
      )}

      {modalOpen && (
        <StartNextSeasonModal
          orgSlug={orgSlug}
          teamId={teamId}
          currentSeasonName={season.name}
          defaultNextYear={nextYearDefault}
          onClose={() => setModalOpen(false)}
          onDone={() => { window.location.assign(base); }}
        />
      )}
    </div>
  );
}
