'use client';
/**
 * RULES & RESOURCES — Tournament admin redesign Stage 5 (E6, A50, A54; F30, F31), built to hub v45, ruled as drawn
 * 2026-10-10.
 *
 *   two cards   Rules ("As families read them on the public site": a row per section, then Start from a sample) and
 *               Resources & downloads (a row per link or file). Each card's add is its head's button: + on a phone,
 *               worded at a desk. An empty card says one sentence (no blank area, no dashed box).
 *   a row       opens its record (RuleSectionRecord / ResourceRecord): reads first, the pencil edits all of it, which
 *               saves itself; Delete ends it and asks. Adding asks (the same window's Save).
 *   order       at a desk each row drags by its handle; anywhere, Tools → Reorder is a mode of the same lists (Move up
 *               / Move down, Done). Tools also holds the public page's layout (one column or two; a list or two
 *               columns) — today an icon pair hidden below 900px.
 *   saving      every write reports its failure — the record's pill, or this page's for an order or a layout. No
 *               browser alert, no leave dialog, no patched browser Back (there is nothing unsaved to protect).
 */
import { useCallback, useEffect, useState } from 'react';
import { ListOrdered, MoreHorizontal, Plus } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { ClubRow, ClubRowList, ClubSection, LoadFailed, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { MoveButtons, SortableRow, SortableRows, moved } from '@/components/admin/tournament/OrderParts';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { createRuleSection, getResources, getRules, saveResource, saveResourceOrder, saveRuleOrder } from '@/lib/db';
import { ORDER_WORDS, RULES_WORDS as W, resourceCaption, sectionCaption } from '@/lib/tournament-settings-words';
import type { Resource, RuleSection, Tournament } from '@/lib/types';
import RuleSectionRecord, { namesFor, type RuleDivision } from './RuleSectionRecord';
import ResourceRecord, { isResourceFile } from './ResourceRecord';
import SamplesWindow from './SamplesWindow';
import type { SampleResource, SampleSection } from './rules-samples';
import styles from './rules.module.css';

/** Rules & resources' "?" (A56): its own help sub-topic. */
const RULES_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['venues-contacts-rules'], subtopicId: 'rules-records' };

export default function RulesAdmin({ tournament, orgSlug }: { tournament: Tournament; orgSlug?: string }) {
  const [rules, setRules] = useState<RuleSection[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [divisions, setDivisions] = useState<RuleDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<string | null>(null);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [rulesLayout, setRulesLayout] = useState<'columns' | 'single'>(tournament.settings?.rulesLayout ?? 'columns');
  const [resourcesLayout, setResourcesLayout] = useState<'list' | 'grid'>(tournament.settings?.resourcesLayout ?? 'list');

  /** Re-reads both lists and the divisions; false when they didn't load. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const [r, res, divRes] = await Promise.all([
        getRules(tournament.id, { strict: true }),
        getResources(tournament.id, { strict: true }),
        fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournament.id)}${orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : ''}`, { cache: 'no-store' }),
      ]);
      // A failed read says so: never "every division" or "No rules yet" over what exists.
      const divs = divRes.ok ? await divRes.json().catch(() => null) as Array<{ id: string; name: string }> | null : null;
      if (!Array.isArray(divs)) throw new Error('divisions');
      setRules(r);
      setResources(res);
      setDivisions(divs.map(d => ({ id: d.id, name: d.name })));
      setLoadError(false);
      return true;
    } catch {
      setLoadError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tournament.id, orgSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own rules
    setLoading(true);
    setOpenSection(null);
    setOpenResource(null);
    setReordering(false);
    void refresh();
  }, [refresh]);

  // ── The page's own saves (an order, a layout): one at a time, the floating pill says each, Retry replays the last ──
  const { saving: pageSaving, error: pageError, run: runPageSave, retry: retryPageSave } = useSaveQueue();

  function moveSection(from: number, to: number) {
    const next = moved(rules, from, to);
    setRules(next);
    void runPageSave(() => saveRuleOrder(next.map(s => s.id)), ORDER_WORDS.saveFailed);
  }
  function moveResource(from: number, to: number) {
    const next = moved(resources, from, to);
    setResources(next);
    void runPageSave(() => saveResourceOrder(next.map(r => r.id)), ORDER_WORDS.saveFailed);
  }
  function chooseLayout(key: 'rulesLayout' | 'resourcesLayout', value: string) {
    if (key === 'rulesLayout') setRulesLayout(value as 'columns' | 'single');
    else setResourcesLayout(value as 'list' | 'grid');
    void runPageSave(async () => {
      const res = await fetch(`/api/admin/tournaments${orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'patch-settings', id: tournament.id, data: { settings: { [key]: value } } }),
      });
      if (!res.ok) throw new Error('layout');
    }, W.layoutFailed);
  }

  // ── Samples: add as today, each failure said in the window ──
  async function addSampleSection(sample: SampleSection) {
    await createRuleSection(tournament.id, nextRuleOrder, { title: sample.title, icon: sample.icon, divisionIds: null, items: sample.items });
    await refresh();
  }
  async function addSampleResource(sample: SampleResource) {
    await saveResource({ tournamentId: tournament.id, label: sample.label, url: sample.url || '#', order: nextResourceOrder });
    await refresh();
  }

  const sectionNames = (s: RuleSection) => namesFor(s.divisionIds, divisions);
  // A new row goes after the last one (never the list's length, which collides once rows were moved or deleted).
  const nextRuleOrder = rules.reduce((m, s) => Math.max(m, (s.order ?? 0) + 1), 0);
  const nextResourceOrder = resources.reduce((m, r) => Math.max(m, (r.order ?? 0) + 1), 0);
  const sIdx = openSection && openSection !== 'new' ? rules.findIndex(s => s.id === openSection) : -1;
  const rIdx = openResource && openResource !== 'new' ? resources.findIndex(r => r.id === openResource) : -1;

  const tools = (
    <CoachToolbarMenu
      label={W.tools}
      icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
      collapseOnPhone
      bareOnPhone
      drawerOnPhone
      drawerTitle={W.tools}
      triggerClassName={`${tb.tool} ${styles.tool}`}
    >
      <CoachToolbarMenuItem icon={<ListOrdered size={16} aria-hidden />} label={ORDER_WORDS.reorder}
        disabled={rules.length + resources.length < 2} onSelect={() => setReordering(true)} />
      <CoachToolbarMenuHeading>{W.rulesLayout}</CoachToolbarMenuHeading>
      <CoachToolbarMenuItem label={W.oneColumn} checked={rulesLayout === 'single'} onSelect={() => chooseLayout('rulesLayout', 'single')} />
      <CoachToolbarMenuItem label={W.twoColumns} checked={rulesLayout === 'columns'} onSelect={() => chooseLayout('rulesLayout', 'columns')} />
      <CoachToolbarMenuHeading>{W.resourcesLayout}</CoachToolbarMenuHeading>
      <CoachToolbarMenuItem label={W.aList} checked={resourcesLayout === 'list'} onSelect={() => chooseLayout('resourcesLayout', 'list')} />
      <CoachToolbarMenuItem label={W.twoColumns} checked={resourcesLayout === 'grid'} onSelect={() => chooseLayout('resourcesLayout', 'grid')} />
    </CoachToolbarMenu>
  );
  const addButton = (label: string, onClick: () => void) => (
    <button type="button" className={`btn btn-outline btn-data ${screenParts.headerButton}`} onClick={onClick}
      aria-label={label} title={label} aria-haspopup="dialog">
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{label}</span>
    </button>
  );
  const done = (
    <button type="button" className={`btn btn-outline btn-data ${screenParts.headerButton}`} onClick={() => setReordering(false)}>
      {ORDER_WORDS.done}
    </button>
  );

  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={W.title}
        inlineActions
        actions={<HelpButton help={RULES_HELP} label={W.title} iconOnly />}
      />

      {loadError && rules.length === 0 && resources.length === 0 ? (
        <LoadFailed title={W.loadFailed} onRetry={() => { setLoading(true); void refresh(); }} />
      ) : loading ? (
        <p className={styles.quiet} role="status">Loading…</p>
      ) : (
        <>
          {reordering && <p className={styles.reorderNote} role="status">{W.reorderNote}</p>}

          <ClubSection
            id="rules"
            list
            className={styles.headCard}
            title={<>{W.rules}<span className={styles.headCaption}>{W.rulesCaption}</span></>}
            actions={reordering ? done : <>{tools}{addButton(W.addSection, () => setOpenSection('new'))}</>}
          >
            {rules.length === 0 && <p className={styles.cardEmpty}>{W.noRules}</p>}
            <ClubRowList inset label={W.rules}>
              {reordering ? rules.map((s, i) => (
                <ClubRow key={s.id} title={s.title} caption={sectionCaption(s.items.length, sectionNames(s))}
                  beside={<MoveButtons index={i} count={rules.length} name={s.title} onMove={moveSection} disabled={pageSaving} />} />
              )) : (
                <SortableRows ids={rules.map(s => s.id)} onMove={moveSection}>
                  {rules.map(s => (
                    <SortableRow key={s.id} id={s.id} name={s.title}>
                      {bits => (
                        <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenSection(s.id)} chevron
                          title={s.title} caption={sectionCaption(s.items.length, sectionNames(s))} {...bits} />
                      )}
                    </SortableRow>
                  ))}
                </SortableRows>
              )}
              {!reordering && (
                <ClubRow as="button" aria-haspopup="dialog" onClick={() => setSamplesOpen(true)} chevron
                  title={W.sample} caption={W.sampleCaption} />
              )}
            </ClubRowList>
          </ClubSection>

          <ClubSection
            id="resources"
            list
            className={styles.headCard}
            title={W.resources}
            actions={reordering ? undefined : addButton(W.addResource, () => setOpenResource('new'))}
          >
            {resources.length === 0 ? <p className={styles.cardEmpty}>{W.noResources}</p> : (
              <ClubRowList inset label={W.resources}>
                {reordering ? resources.map((r, i) => (
                  <ClubRow key={r.id} title={r.label} caption={resourceCaption(r.url, isResourceFile(r.url))}
                    beside={<MoveButtons index={i} count={resources.length} name={r.label} onMove={moveResource} disabled={pageSaving} />} />
                )) : (
                  <SortableRows ids={resources.map(r => r.id)} onMove={moveResource}>
                    {resources.map(r => (
                      <SortableRow key={r.id} id={r.id} name={r.label}>
                        {bits => (
                          <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenResource(r.id)} chevron
                            title={r.label} caption={resourceCaption(r.url, isResourceFile(r.url))} {...bits} />
                        )}
                      </SortableRow>
                    ))}
                  </SortableRows>
                )}
              </ClubRowList>
            )}
          </ClubSection>
        </>
      )}

      <SavePill
        saving={pageSaving}
        dirty={false}
        error={pageError}
        onRetry={retryPageSave}
      />

      {openSection && (openSection === 'new' || sIdx >= 0) && (
        <RuleSectionRecord
          section={openSection === 'new' ? null : rules[sIdx]}
          tournamentId={tournament.id}
          divisions={divisions}
          canWrite
          order={nextRuleOrder}
          prev={sIdx > 0 ? { id: rules[sIdx - 1].id, name: rules[sIdx - 1].title } : null}
          next={sIdx >= 0 && sIdx < rules.length - 1 ? { id: rules[sIdx + 1].id, name: rules[sIdx + 1].title } : null}
          position={`${sIdx + 1} of ${rules.length}`}
          onStep={setOpenSection}
          onClose={() => setOpenSection(null)}
          onChanged={refresh}
        />
      )}

      {openResource && (openResource === 'new' || rIdx >= 0) && (
        <ResourceRecord
          resource={openResource === 'new' ? null : resources[rIdx]}
          tournamentId={tournament.id}
          canWrite
          order={nextResourceOrder}
          prev={rIdx > 0 ? { id: resources[rIdx - 1].id, name: resources[rIdx - 1].label } : null}
          next={rIdx >= 0 && rIdx < resources.length - 1 ? { id: resources[rIdx + 1].id, name: resources[rIdx + 1].label } : null}
          position={`${rIdx + 1} of ${resources.length}`}
          onStep={setOpenResource}
          onClose={() => setOpenResource(null)}
          onChanged={refresh}
        />
      )}

      {samplesOpen && (
        <SamplesWindow onAddSection={addSampleSection} onAddResource={addSampleResource} onClose={() => setSamplesOpen(false)} />
      )}
    </div>
  );
}
