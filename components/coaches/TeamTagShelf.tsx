'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CoachCollapseSection from '@/components/coaches/CoachCollapseSection';
import TagManagerList from '@/components/coaches/TagManagerList';
import {
  MONEY_TAG_MANAGE, GAME_TAG_MANAGE, FOCUS_TAG_MANAGE, STAFF_TAG_MANAGE, EQUIPMENT_TAG_MANAGE,
  type ComboTag,
} from '@/components/coaches/TagSearchCombobox';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The Tags SHELF — Team settings' central home for every tag library (One Tag Idiom Q1, owner-
 * ruled 2026-09-01): one row per library with team-scoped counts, expanding IN PLACE into the
 * same `TagManagerList` the picker-door drawer wraps. One manager, two frames — the shelf is the
 * end-of-season tidy; the drawer is the mid-form typo fix; neither may fork from the other.
 *
 * ⚠ **Capability gating is the SERVER's, deliberately.** Each library's GET already enforces its
 * own `canRead` (money rides money caps; the practice vocabularies ride schedule/development), so
 * the shelf simply omits a library whose read is refused rather than re-deriving capability
 * logic client-side — the same answer the route would give, with no second copy to drift.
 *
 * ⚠ The 50-per-kind cap is said ONCE, at the foot (Q8) — the route's refusal stays the backstop.
 * The org-shared sentence renders inside each opened list (once per surface, the same words the
 * drawer shows).
 *
 * Reached by `?section=tags` (the CoachCollapseSection deep-link contract) — the drawer's
 * "All tag libraries → Team settings" footer link lands here.
 */

const LIBRARIES = [
  {
    key: 'money', seg: 'expense-tags', words: MONEY_TAG_MANAGE,
    where: 'Bills, expenses, drives and sponsors — and the Ledger’s Tags filter',
    countNoun: undefined as ((n: number) => string) | undefined,
  },
  {
    key: 'game', seg: 'tags', words: GAME_TAG_MANAGE,
    where: 'Games on the schedule; the Insights results filter',
    countNoun: (n: number) => `on ${n} game${n === 1 ? '' : 's'}`,
  },
  {
    key: 'focus', seg: 'focus-tags', words: FOCUS_TAG_MANAGE,
    where: 'Drills, plan templates, practice plans and each player’s focus area',
    countNoun: undefined,
  },
  {
    key: 'staff', seg: 'staff-tags', words: STAFF_TAG_MANAGE,
    where: 'Who runs a practice, a block or a station',
    countNoun: (n: number) => `on ${n} plan${n === 1 ? '' : 's'}`,
  },
  {
    key: 'equipment', seg: 'equipment-tags', words: EQUIPMENT_TAG_MANAGE,
    where: 'Practice plans, stations and drills',
    countNoun: undefined,
  },
] as const;

type LibState = ComboTag[] | 'denied' | null;

export default function TeamTagShelf({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [libs, setLibs] = useState<Record<string, LibState>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    for (const lib of LIBRARIES) {
      (async () => {
        try {
          const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/${lib.seg}`);
          if (cancelled) return;
          if (!res.ok) { setLibs(p => ({ ...p, [lib.key]: 'denied' })); return; }
          const json = await res.json().catch(() => null);
          setLibs(p => ({ ...p, [lib.key]: Array.isArray(json?.tags) ? (json.tags as ComboTag[]) : 'denied' }));
        } catch {
          if (!cancelled) setLibs(p => ({ ...p, [lib.key]: 'denied' }));
        }
      })();
    }
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  const visible = LIBRARIES.filter(l => Array.isArray(libs[l.key]));
  const loaded = visible.map(l => libs[l.key] as ComboTag[]);
  const totalOwn = loaded.reduce((n, t) => n + t.filter(x => x.teamId !== null).length, 0);
  const totalShared = loaded.reduce((n, t) => n + t.filter(x => x.teamId === null).length, 0);
  const meta = visible.length === 0
    ? 'Your tag libraries'
    : `${totalOwn + totalShared} tag${totalOwn + totalShared === 1 ? '' : 's'} in ${visible.length} librar${visible.length === 1 ? 'y' : 'ies'}${totalShared > 0 ? ` · ${totalShared} shared by your club` : ''}`;

  async function reloadLib(key: string, seg: string) {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/${seg}`);
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.tags)) setLibs(p => ({ ...p, [key]: json.tags as ComboTag[] }));
    } catch { /* the row keeps its last counts */ }
  }

  return (
    <CoachCollapseSection sectionId="tags" title="Tags" defaultOpen={false} meta={meta}>
      <p className={styles.settingWho}>
        The words your team files things under. Renaming one changes it on everything already
        recorded; merging folds two into one and keeps the history.
      </p>

      <div className={styles.tagShelf}>
        {visible.map(lib => {
          const tags = libs[lib.key] as ComboTag[];
          const own = tags.filter(t => t.teamId !== null).length;
          const shared = tags.filter(t => t.teamId === null).length;
          const open = openKey === lib.key;
          return (
            <div key={lib.key} className={styles.tagShelfLib}>
              <button
                type="button"
                className={styles.tagShelfRow}
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : lib.key)}
              >
                <span className={styles.tagShelfName}>{lib.words.title}</span>
                <span className={styles.tagShelfWhere}>{lib.where}</span>
                <span className={styles.tagShelfCount}>
                  <b>{own}</b> yours{shared > 0 ? ` · ${shared} shared` : ''}
                </span>
                {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
              </button>
              {open && (
                <div className={styles.tagShelfBody}>
                  <TagManagerList
                    teamId={teamId}
                    tags={tags}
                    itemNoun={lib.words.itemNoun}
                    basePath={`/api/coaches/${orgSlug}/teams/${teamId}/${lib.seg}`}
                    countNoun={lib.countNoun}
                    showSummary={false}
                    onChanged={() => { void reloadLib(lib.key, lib.seg); }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Q8: the cap, said once, here — the route's refusal stays the backstop. */}
      <p className={styles.tagShelfFoot}>
        Each library holds up to 50 of your own tags. Merge two to make room.
      </p>
    </CoachCollapseSection>
  );
}
